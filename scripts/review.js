#!/usr/bin/env node
/**
 * scripts/review.js
 *
 * Standalone CLI runner for the Question Reviewer Agent.
 *
 * ─── USAGE ────────────────────────────────────────────────────────────────────
 *
 *  Single chapter:
 *    node scripts/review.js --subject "Biology" --chapterIds "id1"
 *
 *  Multiple chapters (comma-separated, processed one by one):
 *    node scripts/review.js --subject "Biology" --chapterIds "id1,id2,id3"
 *
 *  All chapters of a subject (fetched automatically):
 *    node scripts/review.js --subject "Biology" --all-chapters
 *
 *  Resume after a crash (skips already-completed chapters):
 *    node scripts/review.js --subject "Biology" --all-chapters --resume
 *    node scripts/review.js --subject "Biology" --chapterIds "id1,id2,id3" --resume
 *
 * ─── OPTIONS ──────────────────────────────────────────────────────────────────
 *  --subject      <name>        Subject name                      (REQUIRED)
 *  --chapterIds   <id,id,...>   One or more chapter ObjectIds, comma-separated
 *  --all-chapters               Auto-fetch every chapter for the subject
 *  --resume                     Skip chapters already in checkpoint file
 *  --standard     <num>         Class/grade filter                (optional)
 *  --db           <mode>        "live" (default) | "test"
 *  --delay        <ms>          Pause between chapters            (default: 3000)
 */

import dotenv from "dotenv";
import mongoose from "mongoose";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../.env") });

import { runReviewerAgent, listChaptersForSubject } from "../ai/agents/reviewerAgent.js";

// ─────────────────────────────────────────────────────────────────────────────
//  Arg parsing
// ─────────────────────────────────────────────────────────────────────────────
function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const key = argv[i];
    if (key.startsWith("--")) {
      const next = argv[i + 1];
      if (!next || next.startsWith("--")) {
        args[key.slice(2)] = true;
      } else {
        args[key.slice(2)] = next;
        i++;
      }
    }
  }
  return args;
}

const args       = parseArgs(process.argv.slice(2));
const subject    = args.subject    || null;
// Accept both --chapterIds and --chapterId (singular alias)
const _chapterIdsRaw = args.chapterIds || args.chapterId || "";
const chapterIds = _chapterIdsRaw
  ? String(_chapterIdsRaw).split(",").map((s) => s.trim()).filter(Boolean)
  : [];
const allChapters  = !!args["all-chapters"];
const resume       = !!args.resume;
const standard     = args.standard ? Number(args.standard) : undefined;
const dbMode       = args.db       || "live";
const chapterDelay = args.delay    ? Number(args.delay)    : 3000;

// ─────────────────────────────────────────────────────────────────────────────
//  Usage guard
// ─────────────────────────────────────────────────────────────────────────────
if (!subject) {
  console.error(`
Usage: node scripts/review.js --subject <name> [options]

Options:
  --chapterIds  <id,id,...>  One or more chapter IDs, comma-separated
  --all-chapters             Auto-fetch and process every chapter in the subject
  --resume                   Skip chapters already recorded in checkpoint (after crash)
  --standard    <num>        Filter by class/grade
  --db          <mode>       "live" (default) or "test"
  --delay       <ms>         Pause between chapters (default: 3000)

Examples:
  node scripts/review.js --subject "Biology" --chapterIds "665f...1"
  node scripts/review.js --subject "Biology" --chapterIds "id1,id2,id3"
  node scripts/review.js --subject "Biology" --all-chapters
  node scripts/review.js --subject "Biology" --all-chapters --resume
`);
  process.exit(1);
}

// ─────────────────────────────────────────────────────────────────────────────
//  DB connect
// ─────────────────────────────────────────────────────────────────────────────
const uri = dbMode === "test" ? process.env.MONGO_URI : process.env.MAIN_DATABASE_URL;
if (!uri) {
  console.error(`[CLI] MongoDB URI for mode "${dbMode}" not found in .env`);
  process.exit(1);
}

console.log(`\n[CLI] Connecting to ${dbMode} database…`);
await mongoose.connect(uri, { dbName: "leadllyQuestions" });
console.log("[CLI] Connected.");

// ─────────────────────────────────────────────────────────────────────────────
//  AWS credential guard
// ─────────────────────────────────────────────────────────────────────────────
const accessKey = process.env.AWS_BEDROCK_ACCESS_KEY;
const secretKey = process.env.AWS_BEDROCK_SECRET_KEY;
if (!accessKey || !secretKey) {
  console.error("\n[CLI] ❌  AWS Bedrock credentials missing in .env");
  console.error(`       AWS_BEDROCK_ACCESS_KEY = ${accessKey ? "✓ set" : "✗ MISSING"}`);
  console.error(`       AWS_BEDROCK_SECRET_KEY = ${secretKey ? "✓ set" : "✗ MISSING"}`);
  await mongoose.disconnect();
  process.exit(1);
}
console.log("[CLI] AWS credentials: ✓\n");

// ─────────────────────────────────────────────────────────────────────────────
//  Helpers
// ─────────────────────────────────────────────────────────────────────────────
const SEP = "══════════════════════════════════════════════════════";

function printHeader(label) {
  console.log(SEP);
  if (label) console.log(`  ${label}`);
  console.log(SEP);
}

function fmtStats(s) {
  return (
    `✓ correct:${s.correct}  ` +
    `✦ enriched:${s.enriched}  ` +
    `⇄ reassigned:${s.reassigned}  ` +
    `✗ idled:${s.idled}  ` +
    `! errors:${s.errors}`
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  Checkpoint  (persisted between runs for --resume)
// ─────────────────────────────────────────────────────────────────────────────
const checkpointFile = path.resolve(
  __dirname,
  `../logs/review-checkpoint-${subject.toLowerCase().replace(/\s+/g, "_")}.json`
);

function loadCheckpoint() {
  try {
    if (fs.existsSync(checkpointFile)) {
      return JSON.parse(fs.readFileSync(checkpointFile, "utf8"));
    }
  } catch {}
  return {
    completedChapterIds: [],
    totalStats: { correct: 0, enriched: 0, reassigned: 0, idled: 0, errors: 0 },
  };
}

function saveCheckpoint(cp) {
  fs.mkdirSync(path.dirname(checkpointFile), { recursive: true });
  fs.writeFileSync(checkpointFile, JSON.stringify(cp, null, 2));
}

// ─────────────────────────────────────────────────────────────────────────────
//  Core loop — process an ordered list of chapter descriptors
//  Each item: { _id: string, name: string, questionCount: number }
// ─────────────────────────────────────────────────────────────────────────────
async function runChapterList(chapters) {
  const totalQuestions = chapters.reduce((s, c) => s + (c.questionCount || 0), 0);

  printHeader(`Question Reviewer Agent`);
  console.log(`  Subject        : ${subject}`);
  console.log(`  Standard       : ${standard ?? "(any)"}`);
  console.log(`  DB mode        : ${dbMode}`);
  console.log(`  Chapters       : ${chapters.length}`);
  console.log(`  Total questions: ${totalQuestions}`);
  console.log(`  Delay between  : ${chapterDelay} ms`);
  if (resume) console.log(`  Checkpoint     : ${checkpointFile}`);
  printHeader("");

  const cp = resume ? loadCheckpoint() : {
    completedChapterIds: [],
    totalStats: { correct: 0, enriched: 0, reassigned: 0, idled: 0, errors: 0 },
  };

  if (resume && cp.completedChapterIds.length > 0) {
    console.log(`[resume] ${cp.completedChapterIds.length} chapter(s) already done — skipping them.\n`);
  }

  let done = 0;

  for (let i = 0; i < chapters.length; i++) {
    const ch = chapters[i];

    // ── Skip if already done (resume mode) ───────────────────────────────────
    if (resume && cp.completedChapterIds.includes(ch._id)) {
      done++;
      console.log(`[${i + 1}/${chapters.length}] ⏭  "${ch.name}" — already done, skipping`);
      continue;
    }

    // ── Banner for this chapter ───────────────────────────────────────────────
    console.log(`\n[${i + 1}/${chapters.length}] ▶  "${ch.name}"  (${ch.questionCount ?? "?"} questions)`);

    // ── Run the agent ─────────────────────────────────────────────────────────
    let chStats;
    try {
      chStats = await runReviewerAgent({
        subject,
        chapterId: ch._id,
        standard,
        onProgress: (p) => {
          const pct = p.total > 0 ? Math.round((p.reviewed / p.total) * 100) : 0;
          process.stdout.write(
            `\r    [${String(pct).padStart(3)}%] ${p.reviewed}/${p.total}  ${fmtStats(p)}   `
          );
        },
      });
      process.stdout.write("\n");
    } catch (err) {
      process.stdout.write("\n");
      console.error(`    ❌ FAILED: ${err.message}`);
      console.error(`    Checkpoint saved. Re-run with --resume to continue from here.`);
      saveCheckpoint(cp);
      await mongoose.disconnect();
      process.exit(1);
    }

    // ── Accumulate & checkpoint ───────────────────────────────────────────────
    for (const k of ["correct", "enriched", "reassigned", "idled", "errors"]) {
      cp.totalStats[k] = (cp.totalStats[k] || 0) + (chStats[k] || 0);
    }
    cp.completedChapterIds.push(ch._id);
    saveCheckpoint(cp);
    done++;

    console.log(`    ✅  ${fmtStats(chStats)}`);
    console.log(
      `    📊  Overall [${done}/${chapters.length} chapters]  ${fmtStats(cp.totalStats)}`
    );

    // ── Pause before next chapter ─────────────────────────────────────────────
    if (i < chapters.length - 1) {
      await new Promise((r) => setTimeout(r, chapterDelay));
    }
  }

  // ── Final summary ─────────────────────────────────────────────────────────
  console.log("");
  printHeader("Complete — Final Stats");
  console.log(`  Chapters : ${done}/${chapters.length}`);
  console.log(`  ${fmtStats(cp.totalStats)}`);
  printHeader("Done");

  if (done === chapters.length && fs.existsSync(checkpointFile)) {
    fs.unlinkSync(checkpointFile);
    console.log("[CLI] Checkpoint removed (full run complete).");
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  Entry — decide which chapter list to use
// ─────────────────────────────────────────────────────────────────────────────
let chapters;

if (allChapters) {
  // Fetch every chapter for the subject from the taxonomy
  console.log(`[CLI] Fetching all chapters for "${subject}"…`);
  chapters = await listChaptersForSubject(subject, standard);
  if (chapters.length === 0) {
    console.error(`[CLI] No chapters found for subject "${subject}" in the taxonomy.`);
    await mongoose.disconnect();
    process.exit(1);
  }
  console.log(`[CLI] Found ${chapters.length} chapters.\n`);

} else if (chapterIds.length > 0) {
  // User supplied specific IDs — look up names + counts so the display is rich
  console.log(`[CLI] Looking up ${chapterIds.length} chapter(s)…`);
  const { Chapter } = await import("../model/chapterModel.js");
  const { Ques }    = await import("../model/quesModel.js");

  chapters = await Promise.all(
    chapterIds.map(async (id) => {
      if (!mongoose.Types.ObjectId.isValid(id)) {
        console.error(`[CLI] ❌  Invalid ObjectId: "${id}"`);
        await mongoose.disconnect();
        process.exit(1);
      }
      const doc = await Chapter.findById(id, { name: 1 }).lean();
      if (!doc) {
        console.error(`[CLI] ❌  Chapter not found: ${id}`);
        await mongoose.disconnect();
        process.exit(1);
      }
      const questionCount = await Ques.countDocuments({
        subject: new RegExp(`^${subject}$`, "i"),
        chaptersId: doc._id,
      });
      return { _id: id, name: doc.name, questionCount };
    })
  );
  console.log(`[CLI] Chapters resolved:\n`);
  chapters.forEach((c, i) =>
    console.log(`  ${i + 1}. "${c.name}" — ${c.questionCount} questions  (${c._id})`)
  );
  console.log("");

} else {
  // No chapter filter — warn and treat as single pass over the whole subject
  console.warn(
    "[CLI] ⚠️  No --chapterIds or --all-chapters given.\n" +
    "      Running over the entire subject at once.\n" +
    "      For large subjects, use --all-chapters instead.\n"
  );
  chapters = [{ _id: undefined, name: `(all of ${subject})`, questionCount: null }];
}

await runChapterList(chapters);

await mongoose.disconnect();
console.log("\n[CLI] Disconnected. Bye.");
