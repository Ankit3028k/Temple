import fitz  # PyMuPDF

pdf_path = "template.pdf"
doc = fitz.open(pdf_path)

for page_num in range(len(doc)):
    page = doc[page_num]
    # Page dimensions
    width, height = page.rect.width, page.rect.height
    print(f"Page {page_num+1} size: {width} x {height} points")

    # Extract text with positions
    words = page.get_text("words")  # list of [x0, y0, x1, y1, word, block_no, line_no, word_no]
    for w in words:
        x0, y0, x1, y1, text, *_ = w
        print(f"Text: '{text}' at ({x0:.1f}, {y0:.1f}) - ({x1:.1f}, {y1:.1f})")
