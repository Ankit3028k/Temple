import fitz  # PyMuPDF

def replace_text_in_pdf(input_pdf, output_pdf):
    doc = fitz.open(input_pdf)

    replacements = {
        "Sahil jain": "Ankit Gangrade",
        "9399567171": "8959305284",
        "JMN/OT/2526/09/1397": "JMN/OT/2025/09/9999",  # Rashid Kramank
        "date_field": "14-09-2025",  # Only date, no time
        "Diwali": "Paryushan",
        "Online": "Cash",
        "₹1000": "1000",
        "₹600": "1500",
        "₹400": "2000",
    }

    # background color (light pink #fff4f4)
    bg_color = (1, 244/255, 244/255)

    for page in doc:
        # ---- Regular replacements ----
        for old, new in replacements.items():
            if old == "date_field":
                continue
            matches = page.search_for(old)
            if not matches:
                continue

            for rect in matches:  # ✅ loop through ALL matches
                page.draw_rect(rect, color=bg_color, fill=bg_color)
                y_offset = 0
                page.insert_text(
                    (rect.x0, rect.y1 + y_offset),
                    new,
                    fontsize=9,
                    fontname="helv",
                    fill=(0, 0, 0)
                )

        # ---- Special handling for date ----
        old_parts = ["06-09-2025", "06:50", "PM"]  # Old date + time chunks
        rects = []
        for part in old_parts:
            found = page.search_for(part)
            if found:
                rects.extend(found)

        if rects:
            # Merge into one bounding box
            x0 = min(r.x0 for r in rects)
            y0 = min(r.y0 for r in rects)
            x1 = max(r.x1 for r in rects)
            y1 = max(r.y1 for r in rects)
            rect = fitz.Rect(x0, y0, x1, y1)

            # Cover old date+time area
            page.draw_rect(rect, color=bg_color, fill=bg_color)

            # Write only the new date (no time)
            new_date = replacements["date_field"]
            y_offset = 0
            page.insert_text(
                (rect.x0, rect.y1 + y_offset),
                new_date,
                fontsize=9,
                fontname="helv",
                fill=(0, 0, 0)
            )

    doc.save(output_pdf)
    print(f"✅ New PDF saved: {output_pdf}")


if __name__ == "__main__":
    replace_text_in_pdf("JainMandirReceipt (1) (3).pdf", "Receipt_Updated.pdf")
