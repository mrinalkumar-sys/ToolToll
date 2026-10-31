import os
import sys

class PDFDocument:
    def __init__(self, filename="ToolToll_Hackathon_Evaluation_Report.pdf"):
        self.filename = filename
        self.width = 595.28  # A4 width in pt
        self.height = 841.89 # A4 height in pt
        self.margin_x = 42.0
        self.margin_top = 45.0
        self.margin_bottom = 45.0
        self.usable_width = self.width - (2 * self.margin_x) # ~511.28 pt
        self.usable_height = self.height - self.margin_top - self.margin_bottom

        self.pages = []
        self.current_stream = []
        self.current_y = 0.0 # From top of usable area downwards
        self.page_number = 1
        self.objects = [] # raw pdf object strings/bytes

    def _add_page(self):
        if self.current_stream:
            self.pages.append(b"".join(self.current_stream))
            self.current_stream = []
        self.current_y = 0.0
        self.page_number += 1

    def _conv_y(self, y_top):
        """Convert top-down y coordinate into PDF bottom-up coordinate"""
        return self.height - self.margin_top - y_top

    def escape_text(self, text):
        text = str(text)
        # Replace non-ascii chars with clean ASCII representations
        replacements = {
            '\u2192': '->',
            '\u2190': '<-',
            '\u2014': '--',
            '\u2013': '-',
            '\u2018': "'",
            '\u2019': "'",
            '\u201c': '"',
            '\u201d': '"',
            '\u2022': '*',
            '\u2713': '[OK]',
            '\u2714': '[OK]',
            '\u2718': '[X]',
            '\u03bc': 'u', # micro
            '\u00b5': 'u',
        }
        for k, v in replacements.items():
            text = text.replace(k, v)
        text = text.encode('ascii', 'replace').decode('ascii')
        text = text.replace('\\', '\\\\').replace('(', '\\(').replace(')', '\\)')
        return text

    def set_color_fill(self, r, g, b):
        self.current_stream.append(f"{r:.3f} {g:.3f} {b:.3f} rg\n".encode('ascii'))

    def set_color_stroke(self, r, g, b):
        self.current_stream.append(f"{r:.3f} {g:.3f} {b:.3f} RG\n".encode('ascii'))

    def draw_rect(self, x, y, w, h, fill_rgb=None, stroke_rgb=None, line_width=1.0):
        pdf_y = self._conv_y(y + h)
        pdf_x = self.margin_x + x
        self.current_stream.append(b"q\n")
        if line_width:
            self.current_stream.append(f"{line_width:.2f} w\n".encode('ascii'))
        if stroke_rgb:
            self.set_color_stroke(*stroke_rgb)
        if fill_rgb:
            self.set_color_fill(*fill_rgb)
        self.current_stream.append(f"{pdf_x:.2f} {pdf_y:.2f} {w:.2f} {h:.2f} re\n".encode('ascii'))
        if fill_rgb and stroke_rgb:
            self.current_stream.append(b"B\n")
        elif fill_rgb:
            self.current_stream.append(b"f\n")
        elif stroke_rgb:
            self.current_stream.append(b"S\n")
        self.current_stream.append(b"Q\n")

    def draw_line(self, x1, y1, x2, y2, stroke_rgb=(0.8, 0.8, 0.8), line_width=1.0):
        py1 = self._conv_y(y1)
        py2 = self._conv_y(y2)
        px1 = self.margin_x + x1
        px2 = self.margin_x + x2
        self.current_stream.append(b"q\n")
        self.current_stream.append(f"{line_width:.2f} w\n".encode('ascii'))
        self.set_color_stroke(*stroke_rgb)
        self.current_stream.append(f"{px1:.2f} {py1:.2f} m {px2:.2f} {py2:.2f} l S\n".encode('ascii'))
        self.current_stream.append(b"Q\n")

    def draw_text(self, text, x, y, font="/F1", size=10.0, color_rgb=(0.1, 0.1, 0.1)):
        pdf_y = self._conv_y(y + size * 0.85)
        pdf_x = self.margin_x + x
        safe = self.escape_text(text)
        self.current_stream.append(b"BT\n")
        self.set_color_fill(*color_rgb)
        self.current_stream.append(f"{font} {size:.2f} Tf\n".encode('ascii'))
        self.current_stream.append(f"{pdf_x:.2f} {pdf_y:.2f} Td\n".encode('ascii'))
        self.current_stream.append(f"({safe}) Tj\n".encode('ascii'))
        self.current_stream.append(b"ET\n")

    def estimate_char_width(self, font, size):
        if "Bold" in font or "F2" in font:
            return size * 0.58
        elif "Courier" in font or "F4" in font:
            return size * 0.60
        else:
            return size * 0.52

    def wrap_text(self, text, max_w, font, size):
        words = text.split(' ')
        lines = []
        cur_line = []
        cur_w = 0.0
        c_w = self.estimate_char_width(font, size)

        for w in words:
            w_len = len(w) * c_w
            space_len = c_w
            if cur_line and (cur_w + space_len + w_len > max_w):
                lines.append(" ".join(cur_line))
                cur_line = [w]
                cur_w = w_len
            else:
                cur_line.append(w)
                cur_w += (space_len if len(cur_line) > 1 else 0) + w_len
        if cur_line:
            lines.append(" ".join(cur_line))
        return lines

    def ensure_space(self, needed_height):
        if self.current_y + needed_height > self.usable_height:
            self._add_page()
            # Draw running header on new page
            self.draw_running_header()
            return True
        return False

    def draw_running_header(self):
        # Header banner line
        self.draw_line(0, 0, self.usable_width, 0, stroke_rgb=(0.85, 0.88, 0.92), line_width=0.8)
        self.draw_text("TOOLTOLL  |  PayPal & AI Hackathon Evaluation & Integration Roadmap", 0, -14, font="/F2", size=8.0, color_rgb=(0.35, 0.42, 0.52))
        self.draw_text("CONFIDENTIAL SUBMISSION DRAFT", self.usable_width - 150, -14, font="/F1", size=8.0, color_rgb=(0.55, 0.60, 0.68))
        self.current_y = 15.0

    def draw_running_footer(self, total_pages=1):
        # Footer is drawn at bottom of each page during finalization
        pass

    def add_page_header_banner(self, title, subtitle, badge="HACKATHON STRATEGY REPORT"):
        # Page 1 top hero banner
        banner_h = 95.0
        self.draw_rect(0, 0, self.usable_width, banner_h, fill_rgb=(0.04, 0.09, 0.18), stroke_rgb=(0.10, 0.18, 0.32), line_width=1.0)
        
        # Accent left stripe (PayPal Blue & Amber)
        self.draw_rect(0, 0, 5, banner_h, fill_rgb=(0.0, 0.44, 0.73)) # PayPal blue
        
        # Badge
        badge_w = 170.0
        self.draw_rect(18, 14, badge_w, 18, fill_rgb=(0.0, 0.30, 0.55), stroke_rgb=(0.15, 0.50, 0.85), line_width=0.8)
        self.draw_text(badge, 24, 18, font="/F2", size=8.0, color_rgb=(0.4, 0.8, 1.0))
        
        # Title
        self.draw_text(title, 18, 38, font="/F2", size=18.0, color_rgb=(1.0, 1.0, 1.0))
        # Subtitle
        self.draw_text(subtitle, 18, 62, font="/F1", size=10.0, color_rgb=(0.75, 0.82, 0.92))
        
        # Meta info row
        self.draw_text("Stack: React + Node.js + Prisma + Groq / Claude / MCP + PayPal Sandbox", 18, 78, font="/F4", size=8.0, color_rgb=(0.95, 0.65, 0.20))
        self.draw_text("Target: http://localhost:5173", self.usable_width - 160, 78, font="/F4", size=8.0, color_rgb=(0.55, 0.75, 0.95))
        
        self.current_y = banner_h + 16.0

    def add_section_header(self, number_str, title, subtitle=None):
        self.ensure_space(46.0 if subtitle else 36.0)
        h = 32.0 if not subtitle else 44.0
        y = self.current_y
        
        # Decorative pill / accent
        self.draw_rect(0, y + 2, 24, 20, fill_rgb=(0.0, 0.44, 0.73))
        self.draw_text(number_str, 5, y + 6, font="/F2", size=10.0, color_rgb=(1.0, 1.0, 1.0))
        
        # Title
        self.draw_text(title, 32, y + 6, font="/F2", size=13.0, color_rgb=(0.06, 0.12, 0.24))
        
        if subtitle:
            self.draw_text(subtitle, 32, y + 24, font="/F1", size=9.0, color_rgb=(0.40, 0.48, 0.58))
            self.draw_line(0, y + 38, self.usable_width, y + 38, stroke_rgb=(0.85, 0.88, 0.92), line_width=0.8)
            self.current_y += 46.0
        else:
            self.draw_line(0, y + 28, self.usable_width, y + 28, stroke_rgb=(0.85, 0.88, 0.92), line_width=0.8)
            self.current_y += 36.0

    def add_card(self, title, body_paragraphs, tag=None, theme="blue"):
        # Theme colors: (fill_rgb, border_rgb, bar_rgb, title_rgb)
        themes = {
            "blue": ((0.96, 0.98, 1.0), (0.78, 0.87, 0.98), (0.0, 0.44, 0.73), (0.03, 0.22, 0.45)),
            "emerald": ((0.95, 0.99, 0.96), (0.72, 0.92, 0.78), (0.10, 0.65, 0.35), (0.04, 0.35, 0.16)),
            "amber": ((1.0, 0.98, 0.93), (0.98, 0.85, 0.60), (0.85, 0.48, 0.05), (0.45, 0.24, 0.02)),
            "slate": ((0.97, 0.98, 0.99), (0.84, 0.88, 0.92), (0.35, 0.42, 0.52), (0.12, 0.16, 0.24)),
        }
        bg, border, bar, t_color = themes.get(theme, themes["blue"])
        
        # Calculate needed height
        w = self.usable_width
        pad_x = 14.0
        inner_w = w - (2 * pad_x) - 6.0
        
        lines_all = []
        for p in body_paragraphs:
            wrapped = self.wrap_text(p, inner_w, "/F1", 9.0)
            lines_all.extend(wrapped)
            lines_all.append("") # paragraph break
        if lines_all and lines_all[-1] == "":
            lines_all.pop()
            
        line_h = 13.0
        card_h = 24.0 + (len(lines_all) * line_h) + 12.0
        
        self.ensure_space(card_h + 8.0)
        y = self.current_y
        
        # Card container
        self.draw_rect(0, y, w, card_h, fill_rgb=bg, stroke_rgb=border, line_width=0.8)
        # Left accent stripe
        self.draw_rect(0, y, 4, card_h, fill_rgb=bar)
        
        # Title
        self.draw_text(title, 14, y + 8, font="/F2", size=10.5, color_rgb=t_color)
        
        if tag:
            tag_w = len(tag) * 5.5 + 10.0
            self.draw_rect(w - tag_w - 12, y + 7, tag_w, 14, fill_rgb=bar)
            self.draw_text(tag, w - tag_w - 7, y + 10, font="/F2", size=7.5, color_rgb=(1.0, 1.0, 1.0))
            
        cur_text_y = y + 25.0
        for l in lines_all:
            if l:
                self.draw_text(l, 14, cur_text_y, font="/F1", size=9.0, color_rgb=(0.20, 0.25, 0.32))
            cur_text_y += line_h
            
        self.current_y += card_h + 10.0

    def add_table(self, title, headers, rows, col_widths):
        # Table with header and word-wrapped cells
        row_pad = 6.0
        cell_font_size = 8.5
        line_h = 11.5
        header_h = 22.0
        
        # Measure row heights
        wrapped_rows = []
        row_heights = []
        for row in rows:
            max_lines = 1
            row_cells_wrapped = []
            for idx, text in enumerate(row):
                w = col_widths[idx] - 12.0 # 6pt padding on each side
                wrapped = self.wrap_text(text, w, "/F1", cell_font_size)
                row_cells_wrapped.append(wrapped)
                if len(wrapped) > max_lines:
                    max_lines = len(wrapped)
            h = (max_lines * line_h) + (2 * row_pad)
            wrapped_rows.append(row_cells_wrapped)
            row_heights.append(h)
            
        total_table_h = header_h + sum(row_heights) + (26.0 if title else 0.0)
        
        # If whole table won't fit, check if at least header + 2 rows fit
        self.ensure_space(header_h + row_heights[0] + (30.0 if title else 10.0))
        
        if title:
            self.draw_text(title, 0, self.current_y, font="/F2", size=10.5, color_rgb=(0.08, 0.14, 0.25))
            self.current_y += 16.0
            
        # Draw Table Header
        y = self.current_y
        self.draw_rect(0, y, self.usable_width, header_h, fill_rgb=(0.08, 0.16, 0.30), stroke_rgb=(0.15, 0.25, 0.42), line_width=0.8)
        
        cur_x = 0.0
        for idx, h in enumerate(headers):
            self.draw_text(h, cur_x + 6, y + 6, font="/F2", size=8.5, color_rgb=(1.0, 1.0, 1.0))
            cur_x += col_widths[idx]
        self.current_y += header_h
        
        # Draw Rows
        for r_idx, (r_cells, r_h) in enumerate(zip(wrapped_rows, row_heights)):
            # Check page break inside table
            if self.current_y + r_h > self.usable_height:
                self._add_page()
                self.draw_running_header()
                # Re-draw table header on new page
                y = self.current_y
                self.draw_rect(0, y, self.usable_width, header_h, fill_rgb=(0.08, 0.16, 0.30), stroke_rgb=(0.15, 0.25, 0.42), line_width=0.8)
                cur_x = 0.0
                for idx, h in enumerate(headers):
                    self.draw_text(h + " (cont.)", cur_x + 6, y + 6, font="/F2", size=8.5, color_rgb=(1.0, 1.0, 1.0))
                    cur_x += col_widths[idx]
                self.current_y += header_h
                
            y = self.current_y
            bg_color = (0.97, 0.98, 0.99) if r_idx % 2 == 1 else (1.0, 1.0, 1.0)
            self.draw_rect(0, y, self.usable_width, r_h, fill_rgb=bg_color, stroke_rgb=(0.85, 0.88, 0.92), line_width=0.5)
            
            cur_x = 0.0
            for c_idx, cell_lines in enumerate(r_cells):
                cell_y = y + row_pad
                is_bold = (c_idx == 0)
                font_to_use = "/F2" if is_bold else "/F1"
                c_color = (0.05, 0.15, 0.30) if is_bold else (0.22, 0.26, 0.32)
                for l in cell_lines:
                    self.draw_text(l, cur_x + 6, cell_y, font=font_to_use, size=cell_font_size, color_rgb=c_color)
                    cell_y += line_h
                cur_x += col_widths[c_idx]
                
            self.current_y += r_h
            
        self.current_y += 12.0

    def add_bullet_point(self, title, description, badge=None):
        w = self.usable_width - 24.0
        lines = self.wrap_text(description, w, "/F1", 9.0)
        needed_h = 16.0 + (len(lines) * 12.5) + 4.0
        self.ensure_space(needed_h)
        
        y = self.current_y
        # Bullet dot
        self.draw_rect(4, y + 4, 6, 6, fill_rgb=(0.0, 0.44, 0.73))
        
        # Title
        self.draw_text(title, 16, y + 2, font="/F2", size=9.5, color_rgb=(0.06, 0.15, 0.28))
        if badge:
            badge_w = len(badge) * 5.2 + 8.0
            self.draw_rect(self.usable_width - badge_w - 4, y + 2, badge_w, 13, fill_rgb=(0.92, 0.95, 0.98), stroke_rgb=(0.70, 0.82, 0.95), line_width=0.6)
            self.draw_text(badge, self.usable_width - badge_w, y + 4, font="/F2", size=7.5, color_rgb=(0.05, 0.35, 0.65))
            
        text_y = y + 16.0
        for l in lines:
            self.draw_text(l, 16, text_y, font="/F1", size=9.0, color_rgb=(0.25, 0.30, 0.38))
            text_y += 12.5
            
        self.current_y += needed_h

    def build_pdf(self):
        # Finalize the last page
        if self.current_stream:
            self.pages.append(b"".join(self.current_stream))
            self.current_stream = []

        total_pages = len(self.pages)
        
        # Now append footer to each page stream with correct "Page X of Y"
        updated_pages = []
        for p_idx, p_stream in enumerate(self.pages):
            footer_stream = []
            # Draw line above footer
            py = self.margin_bottom - 12.0
            px1 = self.margin_x
            px2 = self.margin_x + self.usable_width
            footer_stream.append(f"q\n0.8 w\n0.85 0.88 0.92 RG\n{px1:.2f} {py:.2f} m {px2:.2f} {py:.2f} l S\nQ\n".encode('ascii'))
            
            # Left footer
            footer_stream.append(f"BT\n0.45 0.52 0.60 rg\n/F1 8.0 Tf\n{px1:.2f} {py - 12.0:.2f} Td\n(ToolToll  --  Autonomous AI Agent API Marketplace with PayPal Ledger) Tj\nET\n".encode('ascii'))
            
            # Right footer
            p_text = f"Page {p_idx + 1} of {total_pages}"
            footer_stream.append(f"BT\n0.45 0.52 0.60 rg\n/F2 8.0 Tf\n{px2 - 60.0:.2f} {py - 12.0:.2f} Td\n({p_text}) Tj\nET\n".encode('ascii'))
            
            updated_pages.append(p_stream + b"".join(footer_stream))
            
        self.pages = updated_pages

        # PDF Object Generation
        # 1: Catalog
        # 2: Pages
        # 3 .. 3 + (N-1): Page objects
        # 3 + N .. 3 + 2N - 1: Content stream objects
        # Next 4: Font objects (F1: Helvetica, F2: Helvetica-Bold, F3: Helvetica-Oblique, F4: Courier)
        
        num_pages = len(self.pages)
        page_obj_ids = [3 + i for i in range(num_pages)]
        content_obj_ids = [3 + num_pages + i for i in range(num_pages)]
        font1_id = 3 + (2 * num_pages)
        font2_id = font1_id + 1
        font3_id = font1_id + 2
        font4_id = font1_id + 3
        
        objects = {} # id -> bytes
        
        # 1: Catalog
        objects[1] = b"<< /Type /Catalog /Pages 2 0 R >>"
        
        # 2: Pages
        kids_str = " ".join([f"{pid} 0 R" for pid in page_obj_ids])
        objects[2] = f"<< /Type /Pages /Kids [{kids_str}] /Count {num_pages} >>".encode('ascii')
        
        # Page objects
        for p_idx in range(num_pages):
            pid = page_obj_ids[p_idx]
            cid = content_obj_ids[p_idx]
            p_dict = (
                f"<< /Type /Page /Parent 2 0 R "
                f"/MediaBox [0 0 {self.width:.2f} {self.height:.2f}] "
                f"/Contents {cid} 0 R "
                f"/Resources << /Font << "
                f"/F1 {font1_id} 0 R "
                f"/F2 {font2_id} 0 R "
                f"/F3 {font3_id} 0 R "
                f"/F4 {font4_id} 0 R >> >> >>"
            )
            objects[pid] = p_dict.encode('ascii')
            
        # Content stream objects
        for p_idx in range(num_pages):
            cid = content_obj_ids[p_idx]
            stream_bytes = self.pages[p_idx]
            c_dict = f"<< /Length {len(stream_bytes)} >>\nstream\n".encode('ascii') + stream_bytes + b"\nendstream"
            objects[cid] = c_dict
            
        # Fonts
        objects[font1_id] = b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"
        objects[font2_id] = b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>"
        objects[font3_id] = b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Oblique >>"
        objects[font4_id] = b"<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>"
        
        # Write to file and build xref
        max_id = font4_id
        with open(self.filename, "wb") as f:
            f.write(b"%PDF-1.4\n%\xe2\xe3\xcf\xd3\n")
            offsets = {0: 0}
            
            for obj_id in range(1, max_id + 1):
                offsets[obj_id] = f.tell()
                f.write(f"{obj_id} 0 obj\n".encode('ascii'))
                f.write(objects[obj_id])
                f.write(b"\nendobj\n")
                
            xref_pos = f.tell()
            f.write(f"xref\n0 {max_id + 1}\n".encode('ascii'))
            f.write(b"0000000000 65535 f \n")
            for obj_id in range(1, max_id + 1):
                f.write(f"{offsets[obj_id]:010d} 00000 n \n".encode('ascii'))
                
            trailer = f"trailer\n<< /Size {max_id + 1} /Root 1 0 R >>\nstartxref\n{xref_pos}\n%%EOF\n"
            f.write(trailer.encode('ascii'))
            
        print(f"Generated PDF: {self.filename} ({num_pages} pages, {os.path.getsize(self.filename):,} bytes)")

def generate_report():
    output_pdf = "c:/Users/ASUS/tooltoll/ToolToll_Hackathon_PayPal_AI_Report.pdf"
    doc = PDFDocument(output_pdf)
    
    # ---------------- PAGE 1 ----------------
    doc.add_page_header_banner(
        title="ToolToll: Hackathon Alignment & PayPal-AI Roadmap",
        subtitle="Comprehensive Evaluation Against Official Judging Criteria, Sponsor Tools & PayPal Architecture",
        badge="OFFICIAL EVALUATION & TECHNICAL ROADMAP"
    )
    
    # Executive Summary Card
    doc.add_card(
        title="Executive Summary & Strategic Assessment",
        body_paragraphs=[
            "ToolToll is an outstanding conceptual and technical match for this hackathon. The brief challenges entrants to build an application uniting the PayPal developer platform (sandbox) with an AI tool, model, or platform, where PayPal serves as a central, mission-critical foundation.",
            "ToolToll solves the single greatest infrastructure gap in autonomous AI: AI agents cannot hold bank accounts or manually enter credit card details. By establishing a micro-USD integer ledger funded via PayPal Sandbox Orders/Capture and redeemed via PayPal Payouts, ToolToll allows AI agents to discover, evaluate, and autonomously pay sub-cent fees for real APIs under strict owner-defined spending caps."
        ],
        tag="SCORE: HIGH FIT",
        theme="emerald"
    )
    
    # Section 1: Comparison Matrix
    doc.add_section_header("1", "Hackathon Requirements Comparison Matrix", "Detailed item-by-item breakdown of the official requirements versus current implementation")
    
    matrix_headers = ["Hackathon Requirement", "Current ToolToll Implementation", "Status", "Suggested Action"]
    matrix_widths = [115.0, 195.0, 50.0, 151.28]
    matrix_rows = [
        [
            "PayPal Developer Platform (Sandbox)",
            "Server-side Orders creation (/api/paypal/orders), capture (/capture), and webhook deduplication (/webhooks). Stored in append-only ledger.",
            "Passed",
            "Embed official PayPal Smart Payment Buttons (@paypal/react-paypal-js) in UI."
        ],
        [
            "PayPal Central to Project",
            "PayPal is the primary fiat on-ramp funding the entire agent micro-transaction economy. All API consumption draws from this balance.",
            "Passed",
            "Add live PayPal Payouts API (/v1/payments/payouts) for creator earnings withdrawals."
        ],
        [
            "AI Tool / Model Integration",
            "Groq (llama-3.3-70b), Anthropic Claude, and local deterministic fallback; Anthropic Model Context Protocol (MCP) server for autonomous agents.",
            "Passed",
            "Highlight semantic tool discovery and AI price advisor in the live playground."
        ],
        [
            "Broad PayPal Family (Venmo, Braintree, etc.)",
            "Base PayPal Checkout is active; mock creator payouts in place; risk heuristics implemented for threat analysis.",
            "Partial",
            "Enable Venmo via PayPal Smart Buttons; pitch risk heuristics as Simility-inspired defense."
        ],
        [
            "Sponsor Tool Integrations",
            "Architected for cloud deployment; OpenAPI spec live; data tables present in UI, but sponsor tools not yet leveraged for prize bounties.",
            "Opportunity",
            "Integrate AG Grid, Postman Collection, and Render Blueprint to capture bounties."
        ],
        [
            "Functionality & Reproducibility",
            "Multi-tier container architecture (Docker Compose), Prisma migrations, robust local fallback seed modes for zero-friction judge evaluation.",
            "Passed",
            "Provide 1-click test script; ensure offline fallback works if keys are omitted."
        ],
        [
            "New & Existing Clarification",
            "Brand-new architecture designed for AI agent pay-per-use economy with integer micro-USD precision.",
            "Passed",
            "Clearly document hackathon timeline in Devpost submission text and video."
        ]
    ]
    doc.add_table("", matrix_headers, matrix_rows, matrix_widths)
    
    # ---------------- PAGE 2 / NEXT SECTIONS ----------------
    doc.add_section_header("2", "PayPal Integration Deep Dive & Expansion Roadmap", "Technical examination of payments/ledger architecture and high-impact upgrades")
    
    doc.add_card(
        title="Current PayPal Architecture in Backend & Frontend",
        body_paragraphs=[
            "1. Server-Side Order Creation: Authenticated POST /api/paypal/orders obtains sandbox OAuth tokens and calls PayPal /v2/checkout/orders with intent: CAPTURE and custom_id mapped to user wallet.",
            "2. Atomic Order Capture & Ledger Credit: POST /api/paypal/orders/:orderId/capture commits raw capture data, updates order state to COMPLETED, and executes double-entry credit top-up in micro-USD.",
            "3. Webhook Deduplication: POST /api/webhooks/paypal verifies unique event IDs and checks against existing top-up transactions, preventing double-credit attacks (Hackathon Invariant 11).",
            "4. Current Gaps: Frontend uses simulated popup or auto-capture rather than native PayPal JS SDK; creator payouts use simulated mock adapter without live /v1/payments/payouts invocation."
        ],
        tag="CURRENT STATE",
        theme="blue"
    )
    
    doc.add_bullet_point(
        "Upgrade 1: Official PayPal Smart Payment Buttons (@paypal/react-paypal-js)",
        "Replace simulated modal button with native PayPal, Venmo, and Pay Later buttons inside TopupModal.tsx. Provides an authentic, frictionless payment overlay with zero browser popup blocks.",
        badge="CRITICAL UX"
    )
    doc.add_bullet_point(
        "Upgrade 2: Live PayPal Sandbox Payouts API for Creators (/v1/payments/payouts)",
        "Implement real creator payouts. When an API developer clicks 'Withdraw Earnings', ToolToll triggers a sandbox payout batch directly to their PayPal email, completing a closed-loop micro-economy.",
        badge="HIGH IMPACT"
    )
    doc.add_bullet_point(
        "Upgrade 3: Autonomous 'Auto-Refill' Buffer (PayPal Vault / Subscriptions)",
        "Enable agents to run continuously by configuring an automatic refill rule: 'When wallet drops below $2.00, automatically capture $10.00 via PayPal Vaulted Payment Methods'. Eliminates agent stalling.",
        badge="AI INNOVATION"
    )
    doc.add_bullet_point(
        "Upgrade 4: Simility-Inspired Fraud & Abuse Detection",
        "Position ToolToll's Neural Phishing Shield and rate-limiting gateway as a Simility-inspired transaction risk scoring system that inspects prompts and freezes abusive agent loops before funds are depleted.",
        badge="PAYPAL FAMILY"
    )
    doc.add_bullet_point(
        "Upgrade 5: Webhook Dispute & Refund Handling",
        "Handle PAYMENT.CAPTURE.REFUNDED and CUSTOMER.DISPUTE.CREATED in paypalController.ts, recording compensating DEBIT ledger entries to maintain mathematical audit consistency.",
        badge="FINTECH RIGOR"
    )
    
    # ---------------- PAGE 3 / SPONSOR TOOLS ----------------
    doc.add_section_header("3", "Sponsor Tools Integration Strategy (Prize Bounties)", "Actionable roadmap to integrate hackathon sponsor tools and compete for specialized prizes")
    
    doc.add_card(
        title="Why Sponsor Tool Integrations Matter for Hackathons",
        body_paragraphs=[
            "Hackathons typically allocate substantial prize pools to specific sponsor categories (e.g. Best Use of AG Grid, Best Postman Collection, Best Render Deployment). Because many teams only build for the general track, competing in sponsor categories drastically multiplies your winning probability."
        ],
        theme="amber"
    )
    
    sponsor_headers = ["Sponsor Tool", "Strategic Fit for ToolToll", "Concrete Integration Steps", "Prize Category"]
    sponsor_widths = [85.0, 140.0, 206.28, 80.0]
    sponsor_rows = [
        [
            "AG Grid",
            "ToolToll manages dense financial data: double-entry ledgers, creator earnings, and admin logs.",
            "Install ag-grid-react. Embed dark-themed AG Grid on WalletView.tsx ledger with column filtering, micro-USD sorting, and 1-click CSV export.",
            "Best Financial UI"
        ],
        [
            "Postman",
            "ToolToll is fundamentally an API marketplace and proxy execution gateway.",
            "Publish a comprehensive Postman Collection (v2.1) + Environment covering Auth, Tools, PayPal, and MCP. Add 'Run in Postman' badge in UI & README.",
            "Best API Docs"
        ],
        [
            "Render",
            "Application requires consistent multi-tier deployment (Node, Postgres, React).",
            "Add render.yaml Blueprint at repo root defining managed Postgres, backend service, and frontend static site. Add 1-click 'Deploy to Render' button.",
            "Best Cloud Deploy"
        ],
        [
            "APIMatic",
            "ToolToll exports OpenAPI 3.0 specification at /api/docs.",
            "Generate multi-language client SDKs (TypeScript, Python) from ToolToll OpenAPI spec. Provide SDK download buttons on tool catalog views.",
            "Developer Experience"
        ],
        [
            "Zapier",
            "Agent spend events and creator payouts require automated notifications.",
            "Add Zapier outbound webhook triggers: 1) Wallet low-balance alert, 2) Creator payout confirmed, 3) Human-approval spend threshold exceeded.",
            "Best Automation"
        ],
        [
            "Bryntum",
            "Multi-step agent execution workflows require visual timeline tracking.",
            "Use Bryntum Scheduler / Timeline in PlaygroundView.tsx to render agent step sequence, latency breakdown (ms), and cost per millisecond.",
            "Best Visualization"
        ],
        [
            "Elastic",
            "Tool marketplace requires semantic & keyword search across tags and descriptions.",
            "Integrate Elasticsearch BM25 indexing for tool discovery and centralized audit log query aggregation.",
            "Best Search / AI"
        ]
    ]
    doc.add_table("", sponsor_headers, sponsor_rows, sponsor_widths)
    
    # ---------------- PAGE 4 / ACTION PLAN & SUBMISSION ----------------
    doc.add_section_header("4", "Recommended Action Plan & Submission Checklist", "Step-by-step roadmap to finalize code, recording, and submission deliverables")
    
    doc.add_card(
        title="Priority 1: Polish PayPal Experience & Visual Proof (Next 2-4 Hours)",
        body_paragraphs=[
            "1. Embed @paypal/react-paypal-js in TopupModal.tsx so judges see the official PayPal and Venmo buttons directly inside the app.",
            "2. Connect sandbox credentials (set PAYMENT_ADAPTER=paypal in .env) and verify live capture flow on video.",
            "3. Add PayPal Payouts API endpoint in creatorController.ts for creator balance withdrawal, demonstrating the complete economic loop.",
            "4. Verify that the Admin Financial Reconciliation table displays PayPal Captured vs. Ledger Credits accurately."
        ],
        tag="IMMEDIATE ACTION",
        theme="emerald"
    )
    
    doc.add_card(
        title="Priority 2: Embed Top 3 Sponsor Integrations (Next 3-6 Hours)",
        body_paragraphs=[
            "1. AG Grid: Replace ledger table in WalletView.tsx with an interactive AG Grid table with CSV export.",
            "2. Postman: Export tooltoll.postman_collection.json and include 'Run in Postman' button in frontend navbar and README.",
            "3. Render: Commit render.yaml blueprint with one-click deployment instructions."
        ],
        tag="SPONSOR PRIZES",
        theme="blue"
    )
    
    doc.add_card(
        title="Priority 3: Demo Video Script & Devpost Text (Final Polish)",
        body_paragraphs=[
            "Structure your 3-minute video around a compelling story:",
            "- Hook (0:00 - 0:30): 'AI agents are performing complex tasks, but cannot buy the APIs they need. ToolToll provides the autonomous payment rails powered by PayPal.'",
            "- Consumer Flow (0:30 - 1:15): Funding the wallet using PayPal Sandbox & Venmo buttons; setting per-call and monthly agent budget caps.",
            "- Autonomous Agent in Action (1:15 - 2:00): Prompt: 'Analyze customer message and translate to French'. Agent uses MCP to discover tools, rank prices, and execute sub-cent calls against the ledger.",
            "- Financial Rigor & Creator Payout (2:00 - 2:45): Show append-only ledger entries; switch to Creator view to show earned micro-USD and withdraw via PayPal Payouts.",
            "- Closing (2:45 - 3:00): Showcase AG Grid ledger analytics, Postman collection, and Render deployment."
        ],
        tag="VIDEO WALKTHROUGH",
        theme="amber"
    )
    
    doc.build_pdf()

if __name__ == "__main__":
    generate_report()
