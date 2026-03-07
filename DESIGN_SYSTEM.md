# OpenClaw Cloud — Design System

## Style: Technical Minimalist
Inspired by technical blueprints and high-end UI wireframes. Flat, 2D, high negative space, structural precision.

## Colors
- **Paper** (background): #F7F7F5
- **Forest** (primary): #1A3C2B
- **Grid** (borders): #3A3A38
- **Coral** (accent): #FF8C69
- **Mint** (accent): #9EFFBF
- **Gold** (accent): #F4D35E

## Typography
- **Headers**: Space Grotesk, bold, tight tracking (-0.02em), line-height 0.9
- **Body**: General Sans
- **Labels/Metadata/Code**: JetBrains Mono, 10-12px, tracking 0.1em, uppercase

## Borders & Styling
- 1px hairlines in #3A3A38 at 20% opacity for dividers
- NO box shadows anywhere
- Border radius: 0px or 2px max
- Images: mix-blend-luminosity 90%, full color on hover

## Layout
- Mosaic background pattern (interlocking rectangular panels)
- Bento grid layouts (1px gaps between cells)
- Sections divided by 1px horizontal lines
- 32px padding inside cards

## Components

### Navigation
- Fixed top, 1px border-bottom
- Logo: 32x32px square in Forest with white icon
- Links: JetBrains Mono, 10px, uppercase, numbered (01. Dashboard)
- Buttons: Ghost (1px border) or solid Forest

### Status Badge
- Inline-flex, 1px border
- 8x8px square dot + JetBrains Mono text
- Padding: 4px 12px

### Cards
- Paper background, 1px border
- Optional L-shaped corner markers (10px) in Forest
- Monospaced header labels with colored left-border accent

### Form Fields
- White background, 1px border
- Monospaced labels above inputs
