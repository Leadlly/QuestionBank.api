import { ConverseCommand } from "@aws-sdk/client-bedrock-runtime";
import { bedrockClient, MODELS } from "../bedrock.js";
import { reviewerPrompt } from "../prompts/reviewerPrompt.js";
import { Ques } from "../../model/quesModel.js";
import { Chapter } from "../../model/chapterModel.js";
import { Topic } from "../../model/topicModel.js";
import { Subtopic } from "../../model/subtopicModel.js";
import mongoose from "mongoose";

const BATCH_SIZE = 20;

// ms to wait between batches — avoids Bedrock TPM rate-limit throttling
const INTER_BATCH_DELAY_MS = 1500;

// Retry config for Bedrock calls
const MAX_RETRIES = 4;
const RETRY_BASE_MS = 3000;

function stripHtml(html = "") {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Exponential-backoff wrapper around a single Bedrock ConverseCommand.
 * Retries on throttling (ThrottlingException) and transient errors.
 */
async function invokeWithRetry(command) {
  let attempt = 0;
  while (true) {
    try {
      return await bedrockClient.send(command);
    } catch (err) {
      const isThrottle =
        err.name === "ThrottlingException" ||
        err.$metadata?.httpStatusCode === 429 ||
        (err.message || "").toLowerCase().includes("throttl");
      const isTransient =
        err.$metadata?.httpStatusCode >= 500 ||
        err.name === "ServiceUnavailableException";

      if ((isThrottle || isTransient) && attempt < MAX_RETRIES) {
        const waitMs = RETRY_BASE_MS * Math.pow(2, attempt);
        console.warn(
          `[ReviewerAgent] Bedrock ${err.name || "error"} — retry ${attempt + 1}/${MAX_RETRIES} in ${waitMs / 1000}s`
        );
        await sleep(waitMs);
        attempt++;
      } else {
        throw err;
      }
    }
  }
}

/**
 * Build a compact taxonomy snapshot for one subject (optionally scoped to one
 * chapter) so the AI knows all valid chapter → topic → subtopic paths.
 *
 * @param {string}   subjectName
 * @param {number}   [standard]
 * @param {string}   [chapterId]   - MongoDB ObjectId string; if given, only load this chapter
 * @returns {Promise<Array>}  chapters with nested topics/subtopics
 */
async function buildTaxonomy(subjectName, standard, chapterId) {
  const chapterFilter = { subjectName: new RegExp(`^${subjectName}$`, "i") };
  if (standard !== undefined) chapterFilter.standard = Number(standard);
  if (chapterId && mongoose.Types.ObjectId.isValid(chapterId)) {
    chapterFilter._id = new mongoose.Types.ObjectId(chapterId);
  }

  const chapters = await Chapter.find(chapterFilter).lean();

  const taxonomy = await Promise.all(
    chapters.map(async (ch) => {
      const topics = await Topic.find({ chapterId: ch._id }).lean();

      const topicsWithSubs = await Promise.all(
        topics.map(async (tp) => {
          const subtopics = await Subtopic.find({ topicId: tp._id }, { _id: 1, name: 1 }).lean();
          return {
            _id: tp._id,
            name: tp.name,
            subtopics: subtopics.map((s) => ({ _id: s._id, name: s.name })),
          };
        })
      );

      return { _id: ch._id, name: ch.name, topics: topicsWithSubs };
    })
  );

  return taxonomy;
}

/**
 * Review one batch of questions with the AI and return verdicts.
 *
 * @param {Array} questions  - plain question docs (lean)
 * @param {Array} taxonomy   - chapters/topics/subtopics for the subject
 * @returns {Promise<Array>} - parsed results array from the AI
 */
async function reviewBatch(questions, taxonomy) {
  const questionList = questions
    .map((q, i) => {
      const chapters   = (q.chapter    || []).join(", ") || "—";
      const topics     = (q.topics     || []).join(", ") || "—";
      const subtopics  = (q.subtopics  || []).join(", ") || "—";
      const chapterIds  = (q.chaptersId  || []).map((id) => id.toString()).join(", ") || "none";
      const topicIds    = (q.topicsId    || []).map((id) => id.toString()).join(", ") || "none";
      const subtopicIds = (q.subtopicsId || []).map((id) => id.toString()).join(", ") || "none";

      return (
        `${i + 1}. [ID:${q._id}]\n` +
        `   Question: ${stripHtml(q.question).slice(0, 400)}\n` +
        `   Current assignment:\n` +
        `     Chapters:  "${chapters}" (IDs: ${chapterIds})\n` +
        `     Topics:    "${topics}" (IDs: ${topicIds})\n` +
        `     Subtopics: "${subtopics}" (IDs: ${subtopicIds})`
      );
    })
    .join("\n\n");

  const taxonomyJson = JSON.stringify(taxonomy, null, 2);

  const userMessage = `
AVAILABLE TAXONOMY (use ONLY these IDs for any assignments):
${taxonomyJson}

QUESTIONS TO REVIEW (${questions.length} total):
${questionList}

For each question output one result object following the instructions in your system prompt.
`.trim();

  const response = await invokeWithRetry(
    new ConverseCommand({
      modelId: MODELS.DEFAULT,
      system: [{ text: reviewerPrompt }],
      messages: [{ role: "user", content: [{ text: userMessage }] }],
    })
  );

  const textBlock = response.output?.message?.content?.find((b) => b.text);
  const rawText = textBlock?.text || "{}";

  const jsonMatch = rawText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return [];

  try {
    const parsed = JSON.parse(jsonMatch[0]);
    return Array.isArray(parsed.results) ? parsed.results : [];
  } catch {
    return [];
  }
}

/**
 * Build a flat lookup Map from the taxonomy for fast applyVerdict lookups.
 *
 * @param {Array} taxonomy
 * @returns {Map<string, { name, topicsMap: Map }>}
 */
function buildTaxonomyMap(taxonomy) {
  const map = new Map();
  for (const ch of taxonomy) {
    const topicsMap = new Map();
    for (const tp of ch.topics) {
      const subtopicsMap = new Map();
      for (const st of tp.subtopics) {
        subtopicsMap.set(st._id.toString(), { name: st.name });
      }
      topicsMap.set(tp._id.toString(), { name: tp.name, subtopicsMap });
    }
    map.set(ch._id.toString(), { name: ch.name, topicsMap });
  }
  return map;
}

/**
 * Apply a single AI verdict to the database.
 *
 * Handles:
 *  - verdict "correct"  → only merge any new additional topics/subtopics
 *  - verdict "reassign" → update primary assignment + merge additional
 *  - verdict "idle"     → clear all allotments
 *
 * @param {object} verdict
 * @param {Map}    taxonomyMap  - chapterId → { name, topicsMap }
 * @param {object} questionDoc  - original lean doc (for current array values)
 */
async function applyVerdict(verdict, taxonomyMap, questionDoc) {
  const {
    questionId,
    verdict: decision,
    chapterId,
    topicId,
    subtopicId,
    additionalTopicIds    = [],
    additionalSubtopicIds = [],
  } = verdict;

  // ── idle: remove all allotments ───────────────────────────────────────────
  if (decision === "idle") {
    await Ques.findByIdAndUpdate(questionId, {
      $set: {
        chapter: [], topics: [], subtopics: [],
        chaptersId: [], topicsId: [], subtopicsId: [],
      },
    });
    return { questionId, action: "idled" };
  }

  // ── correct / reassign: resolve primary assignment ────────────────────────
  let finalChapterId, finalChapterName;
  let finalTopicId, finalTopicName;
  let finalSubtopicId, finalSubtopicName;

  if (decision === "reassign") {
    const chapterDoc = taxonomyMap.get(chapterId?.toString());
    if (!chapterDoc) return { questionId, action: "error", reason: "chapterId not in taxonomy" };

    finalChapterId   = chapterId.toString();
    finalChapterName = chapterDoc.name;

    if (topicId) {
      const topicDoc = chapterDoc.topicsMap.get(topicId.toString());
      if (topicDoc) {
        finalTopicId   = topicId.toString();
        finalTopicName = topicDoc.name;

        if (subtopicId) {
          const subDoc = topicDoc.subtopicsMap.get(subtopicId.toString());
          if (subDoc) {
            finalSubtopicId   = subtopicId.toString();
            finalSubtopicName = subDoc.name;
          }
        }
      }
    }
  } else {
    // "correct" — keep existing primary assignment as-is
    finalChapterId   = (questionDoc.chaptersId  || [])[0]?.toString();
    finalChapterName = (questionDoc.chapter      || [])[0];
    finalTopicId     = (questionDoc.topicsId     || [])[0]?.toString();
    finalTopicName   = (questionDoc.topics       || [])[0];
    finalSubtopicId  = (questionDoc.subtopicsId  || [])[0]?.toString();
    finalSubtopicName= (questionDoc.subtopics    || [])[0];
  }

  // ── resolve additional topics / subtopics ─────────────────────────────────
  // Merge into existing arrays, deduplicating by string ID
  const existingTopicIds    = (questionDoc.topicsId    || []).map((id) => id.toString());
  const existingSubtopicIds = (questionDoc.subtopicsId || []).map((id) => id.toString());
  const existingTopicNames  = questionDoc.topics    || [];
  const existingSubNames    = questionDoc.subtopics  || [];

  // Build final primary arrays (index-0 is the primary, rest are additional)
  const mergedTopicIdStrs    = finalTopicId    ? [finalTopicId]    : [];
  const mergedTopicNames     = finalTopicName  ? [finalTopicName]  : [];
  const mergedSubtopicIdStrs = finalSubtopicId ? [finalSubtopicId] : [];
  const mergedSubNames       = finalSubtopicName ? [finalSubtopicName] : [];

  // Determine the chapter taxonomy to use for additional lookups
  const chapterLookupId = finalChapterId;
  const chapterLookup   = chapterLookupId ? taxonomyMap.get(chapterLookupId) : null;

  for (const addTId of additionalTopicIds) {
    const tIdStr = addTId.toString();
    if (mergedTopicIdStrs.includes(tIdStr)) continue; // already included
    // Verify it belongs to the chapter in taxonomy
    if (!chapterLookup) continue;
    const tDoc = chapterLookup.topicsMap.get(tIdStr);
    if (!tDoc) continue;
    mergedTopicIdStrs.push(tIdStr);
    mergedTopicNames.push(tDoc.name);
  }

  for (const addSId of additionalSubtopicIds) {
    const sIdStr = addSId.toString();
    if (mergedSubtopicIdStrs.includes(sIdStr)) continue;
    // Find which topic owns this subtopic so we can validate
    if (!chapterLookup) continue;
    let found = false;
    for (const [, tDoc] of chapterLookup.topicsMap) {
      const sDoc = tDoc.subtopicsMap.get(sIdStr);
      if (sDoc) {
        mergedSubtopicIdStrs.push(sIdStr);
        mergedSubNames.push(sDoc.name);
        found = true;
        break;
      }
    }
    if (!found) continue;
  }

  // Re-add any previously assigned additional topics/subtopics that were NOT
  // the primary and NOT returned by AI (preserve pre-existing multiples).
  for (let i = 1; i < existingTopicIds.length; i++) {
    const tId = existingTopicIds[i];
    if (!mergedTopicIdStrs.includes(tId)) {
      mergedTopicIdStrs.push(tId);
      mergedTopicNames.push(existingTopicNames[i] || "");
    }
  }
  for (let i = 1; i < existingSubtopicIds.length; i++) {
    const sId = existingSubtopicIds[i];
    if (!mergedSubtopicIdStrs.includes(sId)) {
      mergedSubtopicIdStrs.push(sId);
      mergedSubNames.push(existingSubNames[i] || "");
    }
  }

  // ── Build the $set payload ─────────────────────────────────────────────────
  const $set = {
    topicsId:    mergedTopicIdStrs.map((id)  => new mongoose.Types.ObjectId(id)),
    topics:      mergedTopicNames,
    subtopicsId: mergedSubtopicIdStrs.map((id) => new mongoose.Types.ObjectId(id)),
    subtopics:   mergedSubNames,
  };

  if (decision === "reassign" && finalChapterId) {
    $set.chaptersId = [new mongoose.Types.ObjectId(finalChapterId)];
    $set.chapter    = [finalChapterName];
  }

  await Ques.findByIdAndUpdate(questionId, { $set });

  const addedTopicsCount    = mergedTopicIdStrs.length    - (finalTopicId    ? 1 : 0);
  const addedSubtopicsCount = mergedSubtopicIdStrs.length - (finalSubtopicId ? 1 : 0);

  if (decision === "reassign") {
    return {
      questionId,
      action: "reassigned",
      to: { chapter: finalChapterName, topic: finalTopicName || null, subtopic: finalSubtopicName || null },
      additionalTopicsAdded: addedTopicsCount,
      additionalSubtopicsAdded: addedSubtopicsCount,
    };
  }

  // "correct" — may still have enriched with additional topics
  if (addedTopicsCount > 0 || addedSubtopicsCount > 0) {
    return {
      questionId,
      action: "enriched",
      additionalTopicsAdded: addedTopicsCount,
      additionalSubtopicsAdded: addedSubtopicsCount,
    };
  }

  return { questionId, action: "skipped" };
}

// ─────────────────────────────────────────────────────────────────────────────
//  Public API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Run the full question-reviewer pipeline.
 *
 * @param {object}   opts
 * @param {string}   [opts.subject]     - Restrict to one subject (required when chapterId given)
 * @param {number}   [opts.standard]    - Optional class/grade filter
 * @param {string}   [opts.chapterId]   - Optional MongoDB ObjectId; review only this chapter
 * @param {Function} [opts.onProgress]  - Called after each batch: (stats) => void
 * @returns {Promise<{ total, correct, enriched, reassigned, idled, errors }>}
 */
export async function runReviewerAgent({ subject, standard, chapterId, onProgress } = {}) {
  // ── 1. Build question filter ──────────────────────────────────────────────
  const qFilter = {};
  if (subject)   qFilter.subject  = new RegExp(`^${subject}$`, "i");
  if (standard !== undefined) qFilter.standard = Number(standard);
  if (chapterId && mongoose.Types.ObjectId.isValid(chapterId)) {
    qFilter.chaptersId = new mongoose.Types.ObjectId(chapterId);
  }

  const total = await Ques.countDocuments(qFilter);
  console.log(
    `[ReviewerAgent] ${total} questions to review` +
    (subject   ? ` | subject: ${subject}`       : "") +
    (chapterId ? ` | chapterId: ${chapterId}`   : "") +
    (standard  ? ` | standard: ${standard}`     : "")
  );

  if (total === 0) {
    console.log("[ReviewerAgent] Nothing to review.");
    return { total: 0, correct: 0, enriched: 0, reassigned: 0, idled: 0, errors: 0 };
  }

  // ── 2. Build taxonomy per subject ─────────────────────────────────────────
  // When chapterId is given we only need the taxonomy for that single chapter.
  const subjectNames = subject
    ? [subject]
    : await Ques.distinct("subject", qFilter);

  const taxonomyBySubject = new Map();
  const taxonomyMapBySubject = new Map();

  for (const s of subjectNames) {
    if (!s) continue;
    const tax = await buildTaxonomy(s, standard, chapterId);
    taxonomyBySubject.set(s.toLowerCase(), tax);
    taxonomyMapBySubject.set(s.toLowerCase(), buildTaxonomyMap(tax));
  }

  // ── 3. Page through questions in batches ──────────────────────────────────
  const stats = { total, correct: 0, enriched: 0, reassigned: 0, idled: 0, errors: 0 };
  let page = 0;
  let reviewed = 0;

  while (true) {
    const batch = await Ques.find(qFilter)
      .sort({ createdAt: 1 })
      .skip(page * BATCH_SIZE)
      .limit(BATCH_SIZE)
      .lean();

    if (batch.length === 0) break;

    // Group by subject so each sub-batch gets the right taxonomy
    const bySubject = new Map();
    for (const q of batch) {
      const key = (q.subject || "").toLowerCase();
      if (!bySubject.has(key)) bySubject.set(key, []);
      bySubject.get(key).push(q);
    }

    for (const [subKey, subBatch] of bySubject) {
      const taxonomy    = taxonomyBySubject.get(subKey)    || [];
      const taxonomyMap = taxonomyMapBySubject.get(subKey) || new Map();

      console.log(
        `[ReviewerAgent] Page ${page + 1} | subject=${subKey} | ${subBatch.length} questions`
      );

      let verdicts = [];
      try {
        verdicts = await reviewBatch(subBatch, taxonomy);
      } catch (err) {
        console.error(`[ReviewerAgent] Batch AI call failed:`, err.message);
        console.error(`[ReviewerAgent] Full error:`, err);
        stats.errors += subBatch.length;
        continue;
      }

      // Map questionId → original doc for applyVerdict
      const docById = new Map(subBatch.map((q) => [q._id.toString(), q]));

      for (const v of verdicts) {
        try {
          const originalDoc = docById.get(v.questionId?.toString()) || {};
          const result = await applyVerdict(v, taxonomyMap, originalDoc);

          if      (result.action === "skipped")    stats.correct++;
          else if (result.action === "enriched")   stats.enriched++;
          else if (result.action === "reassigned") stats.reassigned++;
          else if (result.action === "idled")      stats.idled++;
          else                                     stats.errors++;
        } catch (err) {
          console.error(`[ReviewerAgent] applyVerdict failed for ${v.questionId}:`, err.message);
          stats.errors++;
        }
      }

      // Questions the AI skipped entirely
      const returned = verdicts.length;
      if (returned < subBatch.length) {
        stats.errors += subBatch.length - returned;
      }
    }

    reviewed += batch.length;
    if (onProgress) onProgress({ ...stats, reviewed });
    page++;

    // Throttle: give Bedrock a short breather between batches
    await sleep(INTER_BATCH_DELAY_MS);
  }

  console.log("[ReviewerAgent] Done.", stats);
  return stats;
}

/**
 * List all chapters for a subject (used by CLI --all-chapters mode).
 *
 * @param {string} subjectName
 * @param {number} [standard]
 * @returns {Promise<Array<{ _id: string, name: string, questionCount: number }>>}
 */
export async function listChaptersForSubject(subjectName, standard) {
  const chapterFilter = { subjectName: new RegExp(`^${subjectName}$`, "i") };
  if (standard !== undefined) chapterFilter.standard = Number(standard);

  const chapters = await Chapter.find(chapterFilter, { _id: 1, name: 1 }).lean();

  const withCounts = await Promise.all(
    chapters.map(async (ch) => {
      const count = await Ques.countDocuments({
        subject: new RegExp(`^${subjectName}$`, "i"),
        chaptersId: ch._id,
      });
      return { _id: ch._id.toString(), name: ch.name, questionCount: count };
    })
  );

  return withCounts;
}
