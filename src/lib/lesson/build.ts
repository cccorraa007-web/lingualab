import PptxGenJS from "pptxgenjs";
import {
  AlignmentType,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from "docx";
import type { GeneratedLesson, QuestionType } from "./content";

const ORANGE = "E65100";
const DARK = "27272A";
const GRAY = "52525B";

const TYPE_LABEL: Record<QuestionType, string> = {
  blank: "填空题",
  choice: "选择题",
  truefalse: "判断题",
  qa: "问答题",
};

export async function buildPptx(lesson: GeneratedLesson): Promise<Buffer> {
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_WIDE";
  pptx.author = "LinguaLab";
  pptx.title = lesson.title;

  const titleSlide = pptx.addSlide();
  titleSlide.background = { color: "FFF7ED" };
  titleSlide.addText(lesson.title, {
    x: 0.6,
    y: 1.8,
    w: 11.8,
    h: 1.4,
    fontSize: 34,
    bold: true,
    color: DARK,
    align: "center",
  });
  titleSlide.addText("教学课件", {
    x: 0.6,
    y: 3.2,
    w: 11.8,
    h: 0.5,
    fontSize: 18,
    color: ORANGE,
    align: "center",
  });

  if (lesson.objectives.length > 0) {
    const s = pptx.addSlide();
    s.addText("教学目标", {
      x: 0.6,
      y: 0.4,
      w: 11.8,
      h: 0.6,
      fontSize: 24,
      bold: true,
      color: ORANGE,
    });
    s.addText(
      lesson.objectives.map((o) => ({
        text: o,
        options: { bullet: true, color: DARK },
      })),
      { x: 0.8, y: 1.2, w: 11, h: 4.5, fontSize: 16, paraSpaceAfter: 8 },
    );
  }

  if (lesson.vocabulary.length > 0) {
    if (lesson.wordExplanation) {
      for (const v of lesson.vocabulary) {
        const s = pptx.addSlide();
        s.addText(v.word, {
          x: 0.6,
          y: 1.6,
          w: 11.8,
          h: 1.0,
          fontSize: 40,
          bold: true,
          color: DARK,
        });
        const details: { text: string; options: Record<string, unknown> }[] = [];
        if (v.pos) {
          details.push({
            text: v.pos,
            options: { color: ORANGE, bold: true },
          });
        }
        if (v.meaning) {
          details.push({ text: v.meaning, options: { color: GRAY } });
        }
        if (v.example) {
          details.push({ text: v.example, options: { color: DARK, italic: true } });
        }
        if (details.length > 0) {
          s.addText(details, {
            x: 0.6,
            y: 2.8,
            w: 11.8,
            h: 2.5,
            fontSize: 20,
            paraSpaceAfter: 10,
          });
        }
      }
    } else {
      const s = pptx.addSlide();
      s.addText("生词表", {
        x: 0.6,
        y: 0.4,
        w: 11.8,
        h: 0.6,
        fontSize: 24,
        bold: true,
        color: ORANGE,
      });
      const rows: PptxGenJS.TableRow[] = [
        [
          { text: "词汇", options: { bold: true, fill: { color: "FFEDD5" } } },
          { text: "释义", options: { bold: true, fill: { color: "FFEDD5" } } },
        ],
      ];
      for (const v of lesson.vocabulary) {
        rows.push([{ text: v.word }, { text: v.meaning }]);
      }
      s.addTable(rows, {
        x: 0.8,
        y: 1.2,
        w: 11,
        fontSize: 14,
        border: { color: "E4E4E7" },
      });
    }
  }

  for (const o of lesson.outline) {
    const s = pptx.addSlide();
    s.addText(o.title, {
      x: 0.6,
      y: 0.4,
      w: 11.8,
      h: 0.6,
      fontSize: 24,
      bold: true,
      color: DARK,
    });
    if (o.points.length > 0) {
      s.addText(
        o.points.map((p) => ({
          text: p,
          options: { bullet: true, color: GRAY },
        })),
        { x: 0.8, y: 1.2, w: 11, h: 4.5, fontSize: 16, paraSpaceAfter: 8 },
      );
    }
  }

  lesson.exercises.forEach((e, i) => {
    const s = pptx.addSlide();
    s.addText(`练习 ${i + 1} · ${TYPE_LABEL[e.type] ?? "题目"}`, {
      x: 0.6,
      y: 0.4,
      w: 11.8,
      h: 0.6,
      fontSize: 20,
      bold: true,
      color: ORANGE,
    });
    s.addText(e.question, {
      x: 0.8,
      y: 1.1,
      w: 11,
      h: 1.2,
      fontSize: 18,
      color: DARK,
    });
    if (e.options.length > 0) {
      s.addText(
        e.options.map((o, j) => ({
          text: `${String.fromCharCode(65 + j)}. ${o}`,
          options: { color: GRAY },
        })),
        { x: 0.8, y: 2.4, w: 11, h: 3, fontSize: 16, paraSpaceAfter: 6 },
      );
    }
  });

  if (lesson.exercises.length > 0) {
    const s = pptx.addSlide();
    s.addText("参考答案", {
      x: 0.6,
      y: 0.4,
      w: 11.8,
      h: 0.6,
      fontSize: 24,
      bold: true,
      color: ORANGE,
    });
    s.addText(
      lesson.exercises.map((e, i) => ({
        text: `${i + 1}. ${e.answer || "（略）"}`,
        options: { color: GRAY },
      })),
      { x: 0.8, y: 1.2, w: 11, h: 4.5, fontSize: 14, paraSpaceAfter: 8 },
    );
  }

  const buf = await pptx.write({ outputType: "nodebuffer" });
  return Buffer.isBuffer(buf) ? buf : Buffer.from(buf as ArrayBuffer);
}

export async function buildDocx(lesson: GeneratedLesson): Promise<Buffer> {
  const children: (Paragraph | Table)[] = [];

  children.push(
    new Paragraph({
      text: lesson.title,
      heading: HeadingLevel.TITLE,
      alignment: AlignmentType.CENTER,
    }),
  );

  if (lesson.objectives.length > 0) {
    children.push(
      new Paragraph({ text: "教学目标", heading: HeadingLevel.HEADING_1 }),
    );
    for (const o of lesson.objectives) {
      children.push(new Paragraph({ text: o, bullet: { level: 0 } }));
    }
  }

  if (lesson.vocabulary.length > 0) {
    children.push(
      new Paragraph({ text: "生词表", heading: HeadingLevel.HEADING_1 }),
    );
    if (lesson.wordExplanation) {
      for (const v of lesson.vocabulary) {
        children.push(
          new Paragraph({
            text: v.word,
            heading: HeadingLevel.HEADING_2,
          }),
        );
        if (v.pos) {
          children.push(
            new Paragraph({
              children: [
                new TextRun({ text: v.pos, bold: true, color: ORANGE }),
              ],
            }),
          );
        }
        if (v.meaning) {
          children.push(new Paragraph({ text: v.meaning }));
        }
        if (v.example) {
          children.push(
            new Paragraph({
              children: [new TextRun({ text: v.example, italics: true })],
              spacing: { after: 160 },
            }),
          );
        }
      }
    } else {
      const rows = [
        new TableRow({
          children: [
            new TableCell({ children: [new Paragraph("词汇")] }),
            new TableCell({ children: [new Paragraph("释义")] }),
          ],
        }),
        ...lesson.vocabulary.map(
          (v) =>
            new TableRow({
              children: [
                new TableCell({ children: [new Paragraph(v.word)] }),
                new TableCell({ children: [new Paragraph(v.meaning)] }),
              ],
            }),
        ),
      ];
      children.push(
        new Table({ rows, width: { size: 100, type: WidthType.PERCENTAGE } }),
      );
    }
  }

  if (lesson.outline.length > 0) {
    children.push(
      new Paragraph({ text: "内容讲解", heading: HeadingLevel.HEADING_1 }),
    );
    for (const o of lesson.outline) {
      children.push(
        new Paragraph({ text: o.title, heading: HeadingLevel.HEADING_2 }),
      );
      for (const p of o.points) {
        children.push(new Paragraph({ text: p, bullet: { level: 0 } }));
      }
    }
  }

  if (lesson.exercises.length > 0) {
    children.push(
      new Paragraph({ text: "练习题", heading: HeadingLevel.HEADING_1 }),
    );
    lesson.exercises.forEach((e, i) => {
      children.push(
        new Paragraph({
          text: `${i + 1}. [${TYPE_LABEL[e.type] ?? "题目"}] ${e.question}`,
          heading: HeadingLevel.HEADING_2,
        }),
      );
      e.options.forEach((o, j) => {
        children.push(
          new Paragraph({ text: `${String.fromCharCode(65 + j)}. ${o}` }),
        );
      });
    });
    children.push(
      new Paragraph({ text: "参考答案", heading: HeadingLevel.HEADING_1 }),
    );
    lesson.exercises.forEach((e, i) => {
      children.push(new Paragraph({ text: `${i + 1}. ${e.answer || "（略）"}` }));
    });
  }

  const doc = new Document({ sections: [{ children }] });
  return Packer.toBuffer(doc);
}
