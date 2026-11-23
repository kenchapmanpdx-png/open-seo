import { deflateRawSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import {
  compareExport,
  issuesFromRows,
  readCsv,
  readXlsx,
} from "./external-audit";

// Minimal zip writer (deflate) — enough for the reader under test.
function zip(files: Record<string, string>): Buffer {
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;
  for (const [name, text] of Object.entries(files)) {
    const data = deflateRawSync(Buffer.from(text));
    const nameBuf = Buffer.from(name);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(8, 8);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt16LE(nameBuf.length, 26);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(8, 10);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt16LE(nameBuf.length, 28);
    central.writeUInt32LE(offset, 42);
    locals.push(local, nameBuf, data);
    centrals.push(central, nameBuf);
    offset += 30 + nameBuf.length + data.length;
  }
  const cd = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(Object.keys(files).length, 10);
  end.writeUInt32LE(cd.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, cd, end]);
}

describe("external audit import", () => {
  it("reads a Semrush issues sheet and lists misses both ways", () => {
    const xlsx = zip({
      "xl/sharedStrings.xml":
        "<sst><si><t>Issue</t></si><si><t>Failed</t></si><si><t>Broken internal images</t></si><si><t>Malformed links</t></si><si><t>Frames used</t></si><si><t>Brand new check</t></si></sst>",
      "xl/worksheets/sheet1.xml":
        '<worksheet><sheetData><row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c></row>' +
        '<row r="2"><c r="A2" t="s"><v>2</v></c><c r="B2"><v>64</v></c></row>' +
        '<row r="3"><c r="A3" t="s"><v>3</v></c><c r="B3"><v>2</v></c></row>' +
        '<row r="4"><c r="A4" t="s"><v>4</v></c><c r="B4"><v>1</v></c></row>' +
        '<row r="5"><c r="A5" t="s"><v>5</v></c><c r="B5"><v>3</v></c></row></sheetData></worksheet>',
    });
    const [sheet] = readXlsx(xlsx);
    const issues = issuesFromRows(sheet.rows);
    expect(issues.map((i) => [i.name, i.failed])).toEqual([
      ["Broken internal images", 64],
      ["Malformed links", 2],
      ["Frames used", 1],
      ["Brand new check", 3],
    ]);

    const result = compareExport(issues, {
      findings: [
        { code: "F01", title: "Duplicate titles", itemIds: ["P4-01"] },
      ],
      additionalFindings: [
        { code: "F15", title: "Image returns an error", itemIds: ["SUPP-20"] },
      ],
    });
    expect(result.handbookMissed.map((i) => i.name)).toEqual([
      "Malformed links",
    ]);
    expect(result.noHandbookItem.map((i) => i.reason)).toEqual([
      "skip: rare",
      "unknown check name: add it to SEMRUSH_MAP",
    ]);
    expect(result.handbookOnly.map((f) => f.code)).toEqual(["F01"]);
  });

  it("lists pages a caught issue names that no mapped finding covers", () => {
    const issues = issuesFromRows(
      readCsv(
        "Issue,Page URL,Target URL\n" +
          "Missing h1,https://www.a.test/x/,\n" +
          "Missing h1,https://www.a.test/y,\n" +
          "Orphaned sitemap pages,https://www.a.test/sitemap.xml,https://www.a.test/o\n",
      ),
    );
    const result = compareExport(issues, {
      findings: [
        {
          code: "F01",
          title: "Not exactly one H1",
          itemIds: ["P4-01"],
          urls: ["https://a.test/x"],
        },
        {
          code: "F02",
          title: "Orphans",
          itemIds: ["P3-12"],
          urls: ["https://a.test/o"],
        },
      ],
    });
    expect(result.urlMisses.map((i) => [i.name, i.missed])).toEqual([
      ["Missing h1", ["https://www.a.test/y"]],
    ]);
  });

  it("reads a wide pages export (one column per issue) from CSV", () => {
    const rows = readCsv(
      'Page URL,Missing h1,"Doctype not declared"\r\nhttps://a.test/,1,0\r\nhttps://a.test/b/,,1\r\n',
    );
    expect(issuesFromRows(rows)).toEqual([
      { name: "Missing h1", failed: 1, urls: ["https://a.test/"] },
      { name: "Doctype not declared", failed: 1, urls: ["https://a.test/b/"] },
    ]);
  });
});
