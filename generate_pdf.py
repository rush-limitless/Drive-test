#!/usr/bin/env python3
"""
PDF Generator for ADB Framework Release Notes
Converts Markdown release notes to professional PDF format
"""

import os
import sys
from pathlib import Path
import markdown
from weasyprint import HTML, CSS
from weasyprint.text.fonts import FontConfiguration

def generate_pdf():
    """Generate PDF from Markdown release notes"""
    
    # File paths
    md_file = Path("RELEASE_NOTES_v1.0.0.md")
    pdf_file = Path("ADB_Framework_Release_Notes_v1.0.0.pdf")
    
    if not md_file.exists():
        print(f"Error: {md_file} not found")
        return False
    
    # Read Markdown content
    with open(md_file, 'r', encoding='utf-8') as f:
        md_content = f.read()
    
    # Convert Markdown to HTML
    md = markdown.Markdown(extensions=[
        'markdown.extensions.tables',
        'markdown.extensions.fenced_code',
        'markdown.extensions.toc',
        'markdown.extensions.codehilite'
    ])
    
    html_content = md.convert(md_content)
    
    # Professional CSS styling
    css_content = """
    @page {
        size: A4;
        margin: 2cm 1.5cm;
        @top-center {
            content: "ADB Framework Telco Automation - Release Notes v1.0.0";
            font-size: 10pt;
            color: #666;
        }
        @bottom-center {
            content: "Page " counter(page) " of " counter(pages);
            font-size: 10pt;
            color: #666;
        }
    }
    
    body {
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        font-size: 11pt;
        line-height: 1.6;
        color: #333;
        margin: 0;
        padding: 0;
    }
    
    h1 {
        color: #1976d2;
        font-size: 24pt;
        font-weight: 600;
        margin-top: 30pt;
        margin-bottom: 15pt;
        border-bottom: 3px solid #1976d2;
        padding-bottom: 10pt;
        page-break-after: avoid;
    }
    
    h2 {
        color: #1976d2;
        font-size: 18pt;
        font-weight: 600;
        margin-top: 25pt;
        margin-bottom: 12pt;
        page-break-after: avoid;
    }
    
    h3 {
        color: #333;
        font-size: 14pt;
        font-weight: 600;
        margin-top: 20pt;
        margin-bottom: 10pt;
        page-break-after: avoid;
    }
    
    h4 {
        color: #555;
        font-size: 12pt;
        font-weight: 600;
        margin-top: 15pt;
        margin-bottom: 8pt;
        page-break-after: avoid;
    }
    
    p {
        margin-bottom: 10pt;
        text-align: justify;
    }
    
    ul, ol {
        margin-bottom: 12pt;
        padding-left: 20pt;
    }
    
    li {
        margin-bottom: 5pt;
    }
    
    strong {
        font-weight: 600;
        color: #1976d2;
    }
    
    code {
        background-color: #f5f5f5;
        padding: 2pt 4pt;
        border-radius: 3pt;
        font-family: 'Consolas', 'Monaco', monospace;
        font-size: 10pt;
    }
    
    pre {
        background-color: #f8f9fa;
        border: 1px solid #e9ecef;
        border-radius: 5pt;
        padding: 12pt;
        margin: 12pt 0;
        font-family: 'Consolas', 'Monaco', monospace;
        font-size: 9pt;
        line-height: 1.4;
        overflow-x: auto;
    }
    
    pre code {
        background: none;
        padding: 0;
        border-radius: 0;
    }
    
    table {
        width: 100%;
        border-collapse: collapse;
        margin: 15pt 0;
        font-size: 10pt;
    }
    
    th, td {
        border: 1px solid #ddd;
        padding: 8pt 10pt;
        text-align: left;
    }
    
    th {
        background-color: #f8f9fa;
        font-weight: 600;
        color: #1976d2;
    }
    
    tr:nth-child(even) {
        background-color: #f9f9f9;
    }
    
    blockquote {
        border-left: 4px solid #1976d2;
        margin: 15pt 0;
        padding: 10pt 15pt;
        background-color: #f8f9fa;
        font-style: italic;
    }
    
    hr {
        border: none;
        border-top: 2px solid #e9ecef;
        margin: 25pt 0;
    }
    
    .page-break {
        page-break-before: always;
    }
    
    .no-break {
        page-break-inside: avoid;
    }
    
    /* Emoji styling */
    .emoji {
        font-size: 14pt;
        vertical-align: middle;
    }
    
    /* Header styling for release info */
    .release-header {
        background: linear-gradient(135deg, #1976d2, #42a5f5);
        color: white;
        padding: 20pt;
        border-radius: 8pt;
        margin-bottom: 25pt;
    }
    
    .release-header h1 {
        color: white;
        border-bottom: none;
        margin-top: 0;
        text-align: center;
    }
    
    /* Status badges */
    .status-badge {
        background-color: #4caf50;
        color: white;
        padding: 3pt 8pt;
        border-radius: 12pt;
        font-size: 9pt;
        font-weight: 600;
    }
    """
    
    # Complete HTML document
    html_document = f"""
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>ADB Framework Release Notes v1.0.0</title>
    </head>
    <body>
        {html_content}
    </body>
    </html>
    """
    
    try:
        # Create font configuration
        font_config = FontConfiguration()
        
        # Generate PDF
        html_doc = HTML(string=html_document)
        css_doc = CSS(string=css_content, font_config=font_config)
        
        print("Generating PDF...")
        html_doc.write_pdf(pdf_file, stylesheets=[css_doc], font_config=font_config)
        
        print(f"✅ PDF generated successfully: {pdf_file}")
        print(f"📄 File size: {pdf_file.stat().st_size / 1024 / 1024:.2f} MB")
        
        return True
        
    except Exception as e:
        print(f"❌ Error generating PDF: {str(e)}")
        return False

def install_dependencies():
    """Install required dependencies"""
    import subprocess
    
    dependencies = [
        "markdown",
        "weasyprint"
    ]
    
    for dep in dependencies:
        try:
            __import__(dep)
        except ImportError:
            print(f"Installing {dep}...")
            subprocess.check_call([sys.executable, "-m", "pip", "install", dep])

if __name__ == "__main__":
    print("🚀 ADB Framework PDF Generator")
    print("=" * 50)
    
    # Install dependencies if needed
    try:
        install_dependencies()
    except Exception as e:
        print(f"❌ Failed to install dependencies: {e}")
        sys.exit(1)
    
    # Generate PDF
    success = generate_pdf()
    
    if success:
        print("\n✅ PDF generation completed successfully!")
        print("📁 You can find the PDF file in the current directory.")
    else:
        print("\n❌ PDF generation failed!")
        sys.exit(1)