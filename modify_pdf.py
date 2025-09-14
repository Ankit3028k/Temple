import fitz  # PyMuPDF
import json
import os
import sys

def modify_pdf(input_path, output_path, data):
    # Prepare replacement dictionary based on input data
    replacements = {}
    try:
        if data.get('type') == 'donation':
            event_date = data.get('eventDate', '').split('T')[0]  # Remove timestamp
            issue_date = data.get('issueDate', '').split('T')[0]  # Remove timestamp
            replacements = {
                "Sahil jain": data.get('donor', 'N/A'),
                "9399567171": data.get('contact', 'N/A'),
                "JMN/OT/2526/09/1397": data.get('receiptId', 'N/A'),
                "Diwali": data.get('eventName', 'None'),
                "Online": data.get('paymentMode', 'N/A').capitalize(),
                "Rs.1000": f"Rs.{float(data.get('totalAmount', 0)):.2f}",
                "Rs.600": f"Rs.{float(data.get('paidAmount', 0)):.2f}",
                "Rs.400": f"Rs.{float(data.get('pendingAmount', 0)):.2f}",
                "date_field": issue_date or 'N/A'
            }
        else:  # expense
            date = data.get('date', '').split('T')[0]  # Remove timestamp
            issue_date = data.get('issueDate', '').split('T')[0]  # Remove timestamp
            replacements = {
                "Sahil jain": data.get('recipient', 'N/A'),
                "9399567171": data.get('contact', 'N/A'),
                "JMN/OT/2526/09/1397": data.get('receiptId', 'N/A'),
                "Diwali": data.get('purpose', 'None'),
                "Online": data.get('paymentMode', 'N/A').capitalize(),
                "Rs.1000": f"Rs.{float(data.get('totalAmount', 0)):.2f}",
                "Rs.600": f"Rs.{float(data.get('paidAmount', 0)):.2f}",
                "Rs.400": f"Rs.{float(data.get('pendingAmount', 0)):.2f}",
                "date_field": issue_date or 'N/A'
            }
    except Exception as e:
        print(f"Error preparing replacements: {e}")
        sys.exit(1)

    # Open PDF with PyMuPDF for text replacement
    try:
        doc = fitz.open(input_path)
        bg_color = (1, 244/255, 244/255)  # Light pink background

        for page in doc:
            # Regular replacements
            for old, new in replacements.items():
                if old == "date_field":
                    continue
                matches = page.search_for(old)
                if not matches:
                    continue

                for rect in matches:
                    page.draw_rect(rect, color=bg_color, fill=bg_color)
                    # Adjust y_offset for contact number (unchanged, as it's now correct)
                    y_offset = -2 if old == "9399567171" else 0  # Move contact number downward by 2 points
                    if old == "9399567171":
                        insert_y = rect.y1 + y_offset
                        print(f"Contact number rect: x0={rect.x0}, y0={rect.y0}, x1={rect.x1}, y1={rect.y1}")
                        print(f"Inserting contact number at: x={rect.x0}, y={insert_y}")
                    page.insert_text(
                        (rect.x0, rect.y1 + y_offset),
                        new,
                        fontsize=9,
                        fontname="helv",
                        fill=(0, 0, 0)
                    )

            # Special handling for date
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

                # Write only the new date with y_offset to move it upward
                new_date = replacements["date_field"]
                date_y_offset = 2  # Move date upward by 10 points (approx. one line)
                insert_y = rect.y1 - date_y_offset  # Subtract to move up
                print(f"Date rect: x0={rect.x0}, y0={rect.y0}, x1={rect.x1}, y1={rect.y1}")
                print(f"Inserting date at: x={rect.x0}, y={insert_y}")
                page.insert_text(
                    (rect.x0, insert_y),
                    new_date,
                    fontsize=9,
                    fontname="helv",
                    fill=(0, 0, 0)
                )

        # Save the modified PDF directly
        doc.save(output_path)
        doc.close()
        print(f"PDF processed successfully. Output saved to {output_path}")
    except Exception as e:
        print(f"Error processing PDF with PyMuPDF: {e}")
        sys.exit(1)

if __name__ == "__main__":
    if len(sys.argv) < 4:
        print("Usage: python modify_pdf.py input.pdf output.pdf '{\"key\": \"value\"}'")
        sys.exit(1)

    input_pdf = sys.argv[1]
    output_pdf = sys.argv[2]
    data_str = sys.argv[3]
    try:
        data = json.loads(data_str)
    except json.JSONDecodeError as e:
        print(f"Error parsing JSON data: {e}")
        sys.exit(1)

    if os.path.exists(input_pdf):
        modify_pdf(input_pdf, output_pdf, data)
    else:
        print(f"Error: Input PDF '{input_pdf}' not found.")
        sys.exit(1)