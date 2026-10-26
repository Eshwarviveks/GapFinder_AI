import { NextResponse } from "next/server";
import { extractText, getDocumentProxy } from "unpdf";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json(
        {
          error: "No file was provided.",
        },
        { status: 400 }
      );
    }

    const fileName = file.name.toLowerCase();

    // TXT files
    if (fileName.endsWith(".txt")) {
      const buffer = await file.arrayBuffer();
      const text = new TextDecoder().decode(buffer);

      if (!text.trim()) {
        return NextResponse.json(
          {
            error: "No readable text was found in the file.",
          },
          { status: 400 }
        );
      }

      return NextResponse.json({ text });
    }

    // PDF files
    if (fileName.endsWith(".pdf")) {
      const buffer = await file.arrayBuffer();

      const pdf = await getDocumentProxy(
        new Uint8Array(buffer)
      );

      const result = await extractText(pdf, {
        mergePages: true,
      });

      const text = result.text;

      if (
        typeof text !== "string" ||
        !text.trim()
      ) {
        return NextResponse.json(
          {
            error:
              "No readable text was found in the PDF.",
          },
          { status: 400 }
        );
      }

      return NextResponse.json({
        text,
      });
    }

    return NextResponse.json(
      {
        error:
          "Only PDF and TXT files are supported.",
      },
      { status: 400 }
    );
  } catch (error) {
    console.error(
      "Text extraction error:",
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not extract text from the material.",
      },
      { status: 500 }
    );
  }
}