from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import (
    BaseDocTemplate,
    Frame,
    PageBreak,
    PageTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
)


ROOT = Path(__file__).resolve().parents[1]
OUTPUT_DIR = ROOT / "public" / "travel-library"
LOGO_PATH = ROOT / "public" / "cozy-logo.png"

PAGE_WIDTH, PAGE_HEIGHT = letter
MARGIN_X = 0.72 * inch
MARGIN_TOP = 0.78 * inch
MARGIN_BOTTOM = 0.68 * inch

NAVY = colors.HexColor("#123f5b")
TEAL = colors.HexColor("#62a9cf")
MUTED = colors.HexColor("#5e7e8f")
BORDER = colors.HexColor("#dbeafe")
SOFT_BLUE = colors.HexColor("#eff6ff")
SOFT_TEAL = colors.HexColor("#f0f7f8")


styles = getSampleStyleSheet()
styles.add(
    ParagraphStyle(
        name="DocTitle",
        parent=styles["Title"],
        fontName="Helvetica-Bold",
        fontSize=24,
        leading=29,
        textColor=NAVY,
        spaceAfter=10,
    )
)
styles.add(
    ParagraphStyle(
        name="Subtitle",
        parent=styles["BodyText"],
        fontName="Helvetica",
        fontSize=10.5,
        leading=15,
        textColor=MUTED,
        spaceAfter=14,
    )
)
styles.add(
    ParagraphStyle(
        name="SectionHeading",
        parent=styles["Heading2"],
        fontName="Helvetica-Bold",
        fontSize=14,
        leading=18,
        textColor=NAVY,
        spaceBefore=12,
        spaceAfter=6,
    )
)
styles.add(
    ParagraphStyle(
        name="Body",
        parent=styles["BodyText"],
        fontName="Helvetica",
        fontSize=9.7,
        leading=14,
        textColor=colors.HexColor("#344054"),
        spaceAfter=7,
    )
)
styles.add(
    ParagraphStyle(
        name="CozyBullet",
        parent=styles["Body"],
        leftIndent=14,
        firstLineIndent=-8,
        spaceAfter=4,
    )
)
styles.add(
    ParagraphStyle(
        name="CalloutTitle",
        parent=styles["BodyText"],
        fontName="Helvetica-Bold",
        fontSize=9,
        leading=12,
        textColor=NAVY,
        spaceAfter=4,
    )
)
styles.add(
    ParagraphStyle(
        name="CalloutBody",
        parent=styles["BodyText"],
        fontName="Helvetica",
        fontSize=9,
        leading=13,
        textColor=colors.HexColor("#344054"),
    )
)


def footer(canvas, doc):
    canvas.saveState()
    canvas.setStrokeColor(colors.HexColor("#e6f0f2"))
    canvas.line(MARGIN_X, 0.48 * inch, PAGE_WIDTH - MARGIN_X, 0.48 * inch)
    canvas.setFillColor(MUTED)
    canvas.setFont("Helvetica", 8)
    canvas.drawString(MARGIN_X, 0.31 * inch, "Cozy Adventure Vacations - Cozy Concierge Travel Library")
    canvas.drawRightString(PAGE_WIDTH - MARGIN_X, 0.31 * inch, f"Page {doc.page}")
    canvas.restoreState()


def make_doc(path):
    frame = Frame(
        MARGIN_X,
        MARGIN_BOTTOM,
        PAGE_WIDTH - (MARGIN_X * 2),
        PAGE_HEIGHT - MARGIN_TOP - MARGIN_BOTTOM,
        id="normal",
    )
    template = PageTemplate(id="main", frames=[frame], onPage=footer)
    doc = BaseDocTemplate(
        str(path),
        pagesize=letter,
        pageTemplates=[template],
        title=path.stem.replace("-", " ").title(),
        author="Cozy Adventure Vacations",
    )
    return doc


def p(text, style="Body"):
    return Paragraph(text, styles[style])


def bullet(text):
    return p(f"- {text}", "CozyBullet")


def callout(title, body, fill=SOFT_TEAL):
    table = Table(
        [[p(title, "CalloutTitle")], [p(body, "CalloutBody")]],
        colWidths=[PAGE_WIDTH - (MARGIN_X * 2)],
    )
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), fill),
                ("BOX", (0, 0), (-1, -1), 0.8, BORDER),
                ("LEFTPADDING", (0, 0), (-1, -1), 10),
                ("RIGHTPADDING", (0, 0), (-1, -1), 10),
                ("TOPPADDING", (0, 0), (-1, -1), 8),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
            ]
        )
    )
    return table


def title_block(title, subtitle):
    return [
        p(title, "DocTitle"),
        p(subtitle, "Subtitle"),
        callout(
            "Advisor Note",
            "This guide is general travel guidance. Always verify booking-specific details, document requirements, schedules, policies, and pricing with your cruise line or travel advisor.",
            SOFT_BLUE,
        ),
        Spacer(1, 12),
    ]


def section(title, paragraphs=None, bullets=None):
    story = [p(title, "SectionHeading")]
    for text in paragraphs or []:
        story.append(p(text))
    for text in bullets or []:
        story.append(bullet(text))
    return story


def build_life_onboard():
    story = title_block(
        "Life Onboard: Finding Your Cruise Rhythm",
        "How to enjoy the ship without turning your vacation into another packed calendar.",
    )
    story += section(
        "Your Daily Cruise Planner",
        [
            "Use the cruise line app or printed schedule each day to review shows, activities, dining times, port information, live music, family programming, and theme nights.",
            "The goal is not to do everything. Pick a few priorities, then leave room for rest, wandering, and the moments you did not plan.",
        ],
    )
    story += section(
        "You Cannot Do Everything",
        [
            "Modern cruise ships offer more than most guests could experience in one sailing. That is a benefit, not a challenge.",
            "Choose the experiences that matter most to your group and let the rest be optional.",
        ],
    )
    story += section(
        "Sea Days",
        [
            "Sea days are often some of the best days of a cruise because there is no rush to leave the ship.",
        ],
        [
            "Sleep in or enjoy a slow breakfast.",
            "Spend time at the pool, spa, trivia, or live music.",
            "Explore the ship and enjoy meals without watching the clock.",
            "Build in quiet time for reading, relaxing, or simply watching the ocean.",
        ],
    )
    story.append(
        callout(
            "Cozy Tip",
            "Review the schedule, but do not let it become a work calendar. A great cruise rhythm includes open space.",
        )
    )
    story += section(
        "Shows and Entertainment",
        None,
        [
            "Reserve popular shows early when the cruise line allows reservations.",
            "Arrive before showtime, especially for comedy clubs and smaller venues.",
            "Look for theater productions, live music, game shows, outdoor movies, and smaller lounge performances.",
        ],
    )
    story += section(
        "Pool Deck Strategy",
        None,
        [
            "Go early for better seating.",
            "Do not save chairs for hours when your group is not using them.",
            "Keep valuables secure and bring only what you need.",
            "Stay hydrated, reapply sunscreen, and expect wind even in warm weather.",
        ],
    )
    story += section(
        "Getting Around the Ship",
        None,
        [
            "Learn whether your cabin is forward, midship, or aft.",
            "Use public venues as landmarks.",
            "Check deck plans before entering elevators.",
            "Use stairs when practical.",
            "Expect elevators to be busiest after shows, meals, and port returns.",
        ],
    )
    story += section(
        "Dress Codes and Theme Nights",
        [
            "Most modern cruises are more relaxed than many first-time guests expect. Pack for casual evenings, formal or elegant nights, theme parties, and any specialty dining expectations.",
            "One versatile outfit can often cover several nicer evenings without overpacking.",
        ],
    )
    story += section(
        "Stay Connected Without Staying Glued to Your Phone",
        [
            "Use the cruise line app when needed, take photos, and communicate with family. Then put the phone away sometimes and let the ship feel like a getaway.",
        ],
    )
    story += section(
        "Your Onboard Account",
        None,
        [
            "Review charges daily.",
            "Resolve mistakes early.",
            "Do not wait until the final night.",
            "Visit Guest Services after 9:00 PM when possible if the question is not urgent.",
        ],
    )
    story += section(
        "Create Small Traditions",
        None,
        [
            "Morning coffee in the same quiet location.",
            "Family trivia or an evening dessert ritual.",
            "Watching sail away from each port.",
            "A final-night walk around the ship.",
        ],
    )
    story.append(
        callout(
            "Memory Moment",
            "The best cruise schedule is not the one with the most activities. It is the one that leaves you rested, connected, and excited for the next day.",
            colors.HexColor("#ecfdf3"),
        )
    )
    make_doc(OUTPUT_DIR / "life-onboard-cruise-rhythm.pdf").build(story)


def build_facebook_group():
    story = title_block(
        "Join Your Cruise's Facebook Group",
        "A simple pre-cruise step that can add helpful tips, community, and extra fun before embarkation.",
    )
    story += section(
        "How to Find It",
        [
            "Before your cruise, search Facebook for a group created specifically for your sailing. These groups are usually named with the ship and departure date, such as: Ship Name - Sailing Date.",
        ],
    )
    story += section(
        "What Travelers Often Share",
        None,
        [
            "Port and excursion ideas.",
            "Hotel recommendations and transportation options.",
            "Dining, entertainment, and theme-night updates.",
            "Cruise line announcements and packing suggestions.",
            "Questions from other travelers and tips from experienced cruisers.",
        ],
    )
    story += section(
        "Optional Group Activities",
        [
            "Some sailing groups organize optional activities. Participation is completely optional, but these extras can be a fun way to meet people and add something memorable to your cruise.",
        ],
        [
            "Meet-and-greets.",
            "Cabin crawls.",
            "Slot pulls.",
            "Gift exchanges or Secret Santa events.",
            "Group excursions and sail-away gatherings.",
        ],
    )
    story += section(
        "Use Good Judgment",
        [
            "Facebook groups are helpful, but they are not official cruise line resources. Information from other travelers may be incomplete, outdated, or incorrect.",
            "Always verify important details through the cruise line or your travel advisor, especially documentation, boarding requirements, itinerary changes, and cruise line policies.",
        ],
    )
    story += section(
        "Do Not Share Publicly",
        None,
        [
            "Your full reservation number.",
            "Your cabin number.",
            "Travel document details.",
            "Your home address.",
            "Exact dates your home will be unattended.",
        ],
    )
    story.append(
        callout(
            "Cozy Tip",
            "Join the group for ideas and community, but rely on your cruise line and travel advisor for information that could affect your vacation.",
        )
    )
    story.append(
        callout(
            "Memory Moment",
            "A cruise can begin long before embarkation day. Sometimes the first memories are made while chatting with fellow travelers, planning a gift exchange, or recognizing a familiar face when you finally step onboard.",
            colors.HexColor("#ecfdf3"),
        )
    )
    make_doc(OUTPUT_DIR / "join-your-cruise-facebook-group.pdf").build(story)


def build_countdown():
    rows = [
        ("30 Days Before", "Find and join the Facebook group for your specific sailing. Review travel documents and confirm names match IDs."),
        ("21 Days Before", "Check online check-in status, cruise line app access, luggage tags, and dining or entertainment reservations."),
        ("14 Days Before", "Review packing needs, medications, formal or theme-night outfits, and carry-on essentials."),
        ("7 Days Before", "Check weather, airport timing, transfer details, hotel information, and port arrival instructions."),
        ("48 Hours Before", "Charge devices, print or save key documents, check flight status, and keep passports or IDs in your carry-on."),
        ("Departure Day", "Arrive with extra time, keep valuables secure, and start the trip with a little patience and flexibility."),
    ]
    story = title_block(
        "30-Day Cruise Countdown Checklist",
        "A practical final-month checklist to help cruise departure feel calmer.",
    )
    table_data = [[p("Timing", "CalloutTitle"), p("What to Review", "CalloutTitle")]]
    table_data += [[p(timing, "CalloutTitle"), p(task, "CalloutBody")] for timing, task in rows]
    table = Table(table_data, colWidths=[1.65 * inch, 4.95 * inch], repeatRows=1)
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), SOFT_BLUE),
                ("TEXTCOLOR", (0, 0), (-1, 0), NAVY),
                ("BOX", (0, 0), (-1, -1), 0.8, BORDER),
                ("INNERGRID", (0, 0), (-1, -1), 0.4, BORDER),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 8),
                ("RIGHTPADDING", (0, 0), (-1, -1), 8),
                ("TOPPADDING", (0, 0), (-1, -1), 8),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
            ]
        )
    )
    story.append(table)
    story.append(Spacer(1, 14))
    story.append(
        callout(
            "Cozy Tip",
            "Complete online check-in the day it opens when possible. Earlier check-in often means better arrival times and a smoother boarding experience.",
        )
    )
    story.append(PageBreak())
    story += section(
        "Carry-On Essentials",
        None,
        [
            "Passport or ID and cruise documents.",
            "Medications and medical devices.",
            "Phone charger and portable battery.",
            "Swimsuit, sunscreen, sunglasses, and a simple change of clothes.",
            "Valuables and anything needed before luggage arrives at the stateroom.",
        ],
    )
    story.append(
        callout(
            "Cozy Tip",
            "Pack your swimsuit in your carry-on. Many people are enjoying the pool while others are still waiting for luggage.",
        )
    )
    story += section(
        "Final Reminder",
        [
            "If any names, dates, documents, transfers, or payment details look wrong, message your advisor before departure day.",
        ],
    )
    make_doc(OUTPUT_DIR / "30-day-cruise-countdown-checklist.pdf").build(story)


def main():
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    build_life_onboard()
    build_facebook_group()
    build_countdown()
    print("Generated travel library PDFs:")
    for path in sorted(OUTPUT_DIR.glob("*.pdf")):
        print(f"- {path.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
