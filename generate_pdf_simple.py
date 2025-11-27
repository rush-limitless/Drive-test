#!/usr/bin/env python3
"""
Simple PDF Generator for ADB Framework Release Notes
Uses reportlab for cross-platform compatibility
"""

import os
import sys
from pathlib import Path
import re
from datetime import datetime

def install_reportlab():
    """Install reportlab if not available"""
    try:
        import reportlab
    except ImportError:
        import subprocess
        print("Installing reportlab...")
        subprocess.check_call([sys.executable, "-m", "pip", "install", "reportlab"])

def generate_pdf():
    """Generate PDF from Markdown release notes using reportlab"""
    
    # Install reportlab if needed
    install_reportlab()
    
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.units import inch, cm
    from reportlab.lib.colors import HexColor, black, white
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, PageBreak, Table, TableStyle
    from reportlab.platypus.tableofcontents import TableOfContents
    from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY, TA_LEFT
    
    # File paths
    md_file = Path("RELEASE_NOTES_v1.0.0.md")
    pdf_file = Path("ADB_Framework_Release_Notes_v1.0.0.pdf")
    
    if not md_file.exists():
        print(f"Error: {md_file} not found")
        return False
    
    # Read Markdown content
    with open(md_file, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Create PDF document
    doc = SimpleDocTemplate(
        str(pdf_file),
        pagesize=A4,
        rightMargin=2*cm,
        leftMargin=2*cm,
        topMargin=2.5*cm,
        bottomMargin=2*cm
    )
    
    # Define styles
    styles = getSampleStyleSheet()
    
    # Custom styles
    title_style = ParagraphStyle(
        'CustomTitle',
        parent=styles['Title'],
        fontSize=24,
        spaceAfter=30,
        textColor=HexColor('#1976d2'),
        alignment=TA_CENTER,
        fontName='Helvetica-Bold'
    )
    
    heading1_style = ParagraphStyle(
        'CustomHeading1',
        parent=styles['Heading1'],
        fontSize=18,
        spaceAfter=12,
        spaceBefore=20,
        textColor=HexColor('#1976d2'),
        fontName='Helvetica-Bold'
    )
    
    heading2_style = ParagraphStyle(
        'CustomHeading2',
        parent=styles['Heading2'],
        fontSize=14,
        spaceAfter=10,
        spaceBefore=15,
        textColor=HexColor('#333333'),
        fontName='Helvetica-Bold'
    )
    
    heading3_style = ParagraphStyle(
        'CustomHeading3',
        parent=styles['Heading3'],
        fontSize=12,
        spaceAfter=8,
        spaceBefore=12,
        textColor=HexColor('#555555'),
        fontName='Helvetica-Bold'
    )
    
    body_style = ParagraphStyle(
        'CustomBody',
        parent=styles['Normal'],
        fontSize=11,
        spaceAfter=6,
        alignment=TA_JUSTIFY,
        fontName='Helvetica'
    )
    
    code_style = ParagraphStyle(
        'CustomCode',
        parent=styles['Code'],
        fontSize=9,
        fontName='Courier',
        backColor=HexColor('#f5f5f5'),
        borderColor=HexColor('#e0e0e0'),
        borderWidth=1,
        borderPadding=5
    )
    
    # Parse markdown content
    story = []
    
    # Add title page
    story.append(Spacer(1, 2*inch))
    story.append(Paragraph("ADB Framework Telco Automation", title_style))
    story.append(Paragraph("Release Notes v1.0.0", heading1_style))
    story.append(Spacer(1, 0.5*inch))
    
    # Release info table
    release_data = [
        ['Version', '1.0.0'],
        ['Release Date', 'January 15, 2025'],
        ['Release Type', 'Major Release (Production Ready)'],
        ['Branch', 'adb-framework-telco-automation-setup-1.0.0'],
        ['Build Status', '✅ Production Ready']
    ]
    
    release_table = Table(release_data, colWidths=[3*cm, 8*cm])
    release_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), HexColor('#1976d2')),
        ('TEXTCOLOR', (0, 0), (-1, 0), white),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 12),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
        ('BACKGROUND', (0, 1), (-1, -1), HexColor('#f8f9fa')),
        ('GRID', (0, 0), (-1, -1), 1, HexColor('#e0e0e0'))
    ]))
    
    story.append(release_table)
    story.append(PageBreak())
    
    # Process markdown content
    lines = content.split('\n')
    current_section = []
    in_code_block = False
    code_block = []
    
    for line in lines:
        line = line.strip()
        
        if not line and not in_code_block:
            if current_section:
                story.append(Paragraph(' '.join(current_section), body_style))
                current_section = []
            continue
        
        # Handle code blocks
        if line.startswith('```'):
            if in_code_block:
                # End code block
                if code_block:
                    code_text = '\n'.join(code_block)
                    story.append(Paragraph(f'<pre>{code_text}</pre>', code_style))
                    code_block = []
                in_code_block = False
            else:
                # Start code block
                in_code_block = True
            continue
        
        if in_code_block:
            code_block.append(line)
            continue
        
        # Handle headers
        if line.startswith('# '):
            if current_section:
                story.append(Paragraph(' '.join(current_section), body_style))
                current_section = []
            
            header_text = line[2:].strip()
            # Remove emojis for PDF
            header_text = re.sub(r'[^\w\s\-\.\(\)]', '', header_text)
            story.append(Paragraph(header_text, title_style))
            story.append(Spacer(1, 12))
            
        elif line.startswith('## '):
            if current_section:
                story.append(Paragraph(' '.join(current_section), body_style))
                current_section = []
            
            header_text = line[3:].strip()
            header_text = re.sub(r'[^\w\s\-\.\(\)]', '', header_text)
            story.append(Paragraph(header_text, heading1_style))
            
        elif line.startswith('### '):
            if current_section:
                story.append(Paragraph(' '.join(current_section), body_style))
                current_section = []
            
            header_text = line[4:].strip()
            header_text = re.sub(r'[^\w\s\-\.\(\)]', '', header_text)
            story.append(Paragraph(header_text, heading2_style))
            
        elif line.startswith('#### '):
            if current_section:
                story.append(Paragraph(' '.join(current_section), body_style))
                current_section = []
            
            header_text = line[5:].strip()
            header_text = re.sub(r'[^\w\s\-\.\(\)]', '', header_text)
            story.append(Paragraph(header_text, heading3_style))
            
        elif line.startswith('- ') or line.startswith('* '):
            if current_section:
                story.append(Paragraph(' '.join(current_section), body_style))
                current_section = []
            
            bullet_text = line[2:].strip()
            bullet_text = re.sub(r'[^\w\s\-\.\(\):/]', '', bullet_text)
            story.append(Paragraph(f'• {bullet_text}', body_style))
            
        elif line.startswith('---'):
            if current_section:
                story.append(Paragraph(' '.join(current_section), body_style))
                current_section = []
            story.append(Spacer(1, 20))
            
        else:
            # Regular text
            if line:
                # Clean emojis and special characters
                clean_line = re.sub(r'[^\w\s\-\.\(\):/,]', '', line)
                if clean_line.strip():
                    current_section.append(clean_line)
    
    # Add remaining content
    if current_section:
        story.append(Paragraph(' '.join(current_section), body_style))
    
    try:
        # Build PDF
        print("Generating PDF...")
        doc.build(story)
        
        print(f"PDF generated successfully: {pdf_file}")
        print(f"File size: {pdf_file.stat().st_size / 1024 / 1024:.2f} MB")
        
        return True
        
    except Exception as e:
        print(f"Error generating PDF: {str(e)}")
        return False

if __name__ == "__main__":
    print("ADB Framework PDF Generator (Simple)")
    print("=" * 50)
    
    success = generate_pdf()
    
    if success:
        print("\nPDF generation completed successfully!")
        print("You can find the PDF file in the current directory.")
    else:
        print("\nPDF generation failed!")
        sys.exit(1)