---
name: Smart Pineapple
description: A calm, evidence-led field intelligence system for pineapple operations.
colors:
  pine-canopy: "#003f2a"
  pine-canopy-hover: "#0c543d"
  harvest-gold: "#ffd319"
  harvest-olive: "#6b5e00"
  field-mist: "#f4f8f2"
  sidebar-mist: "#f8fbf6"
  surface: "#ffffff"
  soil-ink: "#0f1f1a"
  field-border: "#dfe9dd"
  field-muted: "#52635d"
  healthy: "#c8f6db"
  danger: "#cf1f1f"
  navigation-ink: "#164d3d"
  map-surface: "#e8f0e5"
  tool-ink: "#315447"
  validation-red: "#dc2626"
  empty-border: "#cbd9c9"
  field-overlay-strong: "rgba(0,55,36,.12)"
  field-overlay-soft: "rgba(0,55,36,.08)"
  floating-shadow: "rgba(0,40,24,.14)"
  floating-shadow-soft: "rgba(0,40,24,.12)"
  ambient-shadow: "rgba(0,55,34,.12)"
  mobile-shadow: "rgba(0,55,34,.08)"
  neutral-shadow: "rgba(0,0,0,.16)"
  hotspot-shadow: "rgba(0,0,0,.22)"
  pin-shadow: "rgba(0,0,0,.25)"
  validation-halo: "rgba(220,38,38,.1)"
typography:
  display:
    fontFamily: "Kanit, sans-serif"
    fontSize: "2.5rem"
    fontWeight: 800
    lineHeight: 1.15
    letterSpacing: "normal"
  headline:
    fontFamily: "Kanit, sans-serif"
    fontSize: "2rem"
    fontWeight: 800
    lineHeight: 1.2
    letterSpacing: "normal"
  title:
    fontFamily: "Kanit, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 800
    lineHeight: 1.25
    letterSpacing: "normal"
  body:
    fontFamily: "Kanit, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.6
    letterSpacing: "normal"
  label:
    fontFamily: "Kanit, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 800
    lineHeight: 1.25
    letterSpacing: "0.16em"
rounded:
  nav: "8px"
  control: "10px"
  overlay: "12px"
  panel: "14px"
  pill: "999px"
spacing:
  xs: "6px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "20px"
  panel: "22px"
  section: "28px"
components:
  button-primary:
    backgroundColor: "{colors.pine-canopy}"
    textColor: "{colors.surface}"
    typography: "{typography.body}"
    rounded: "{rounded.control}"
    padding: "11px 20px"
    height: "46px"
  button-primary-hover:
    backgroundColor: "{colors.pine-canopy-hover}"
    textColor: "{colors.surface}"
    rounded: "{rounded.control}"
  button-secondary:
    backgroundColor: "#eef4ec"
    textColor: "{colors.pine-canopy}"
    typography: "{typography.body}"
    rounded: "{rounded.control}"
    padding: "11px 20px"
    height: "46px"
  nav-active:
    backgroundColor: "{colors.pine-canopy}"
    textColor: "{colors.surface}"
    typography: "{typography.body}"
    rounded: "{rounded.nav}"
    padding: "13px 18px"
  metric-card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.soil-ink}"
    rounded: "{rounded.panel}"
    padding: "22px"
  field-input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.soil-ink}"
    typography: "{typography.body}"
    rounded: "{rounded.control}"
    padding: "10px 12px"
  status-chip:
    backgroundColor: "#eef5ec"
    textColor: "#164d3d"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "6px 10px"
---

# Design System: Smart Pineapple

## 1. Overview

**Creative North Star: "The Agronomist’s Field Desk"**

Smart Pineapple should feel like the dependable working surface of an agronomist who must turn many field signals into a clear decision. The interface is calm, evidence-led, and field-ready: pale green operational surfaces support dense data, while Pine Canopy marks navigation, decisive actions, and high-confidence structure.

The system is sturdy and legible rather than ornamental. Repeated controls use familiar shapes and Kanit typography; status color always carries an explicit label or symbol. Motion is limited to fast state feedback, and the layout changes structurally at tablet width so field users retain clear navigation on smaller screens.

It explicitly rejects an overly technical AI console, a generic corporate administration template, and a playful consumer app. AI is presented as evidence for action, never as visual spectacle.

**Key Characteristics:**

- Operational hierarchy led by today’s plots, risks, and actions.
- Restrained field-green palette with Harvest Gold reserved for attention and action.
- Sturdy 8–14px geometry, generous touch targets, and dense but readable data.
- Ambient green-tinted elevation used to separate working layers.
- Thai-first Kanit typography with explicit state labels.

## 2. Colors

The palette pairs the authority of deep cultivated green with clean, low-chroma field surfaces and one ripe yellow signal.

### Primary

- **Pine Canopy** (`#003f2a`): navigation selection, primary actions, section headings, high-confidence data, and dark operational panels.
- **Pine Canopy Hover** (`#0c543d`): the only approved hover shift for primary actions.

### Secondary

- **Harvest Gold** (`#ffd319`): urgent or high-value actions and quality emphasis. It must remain rare enough to signal importance.
- **Harvest Olive** (`#6b5e00`): accessible small labels and caution states on light surfaces; never substitute it for body copy.

### Neutral

- **Field Mist** (`#f4f8f2`): the main application background.
- **Sidebar Mist** (`#f8fbf6`): the navigation layer, separated from content by a quiet divider.
- **Clean Surface** (`#ffffff`): cards, inputs, map tools, and legible data regions.
- **Soil Ink** (`#0f1f1a`): default text and data.
- **Field Muted** (`#52635d`): secondary explanations and empty-state copy.
- **Field Border** (`#dfe9dd`): structural dividers and input boundaries.

### Tertiary

- **Healthy Mint** (`#c8f6db`): positive and online states, always paired with text.
- **Risk Red** (`#cf1f1f`): risk and critical field conditions, always paired with a label or icon.

### Named Rules

**The Field Signal Rule.** Pine Canopy communicates structure; Harvest Gold communicates attention. Never use either as background decoration.

**The Labeled Status Rule.** Healthy, caution, and danger colors never carry meaning alone. Pair every status color with Thai text, a symbol, or both.

## 3. Typography

**Display Font:** Kanit (with sans-serif fallback)  
**Body Font:** Kanit (with sans-serif fallback)  
**Label Font:** Kanit (with sans-serif fallback)

**Character:** One Thai-first geometric sans gives the dashboard a sturdy, field-ready voice across headings, controls, data, and long explanations. Kanit is used with restrained spacing and comfortable leading so it remains operational rather than promotional; competing display faces are prohibited.

### Hierarchy

- **Display** (800, `2.5rem`, 1.15): the primary title of the active operational surface.
- **Headline** (800, `2rem`, 1.2): dashboard section headings and important analytical summaries.
- **Title** (800, `1.5rem`, 1.25): cards, panels, and task groups.
- **Body** (400, `1rem`, 1.6): instructions, descriptions, and field context; explanatory prose stops at 70ch.
- **Label** (800, `0.75rem`, `0.16em`): rare categorical markers and compact statuses. Uppercase or tracked styling is reserved for genuine system categories, not every section.

### Named Rules

**The One Working Voice Rule.** Use Kanit everywhere, including maps and chart labels. Hierarchy comes from size, weight, spacing, and placement—not a decorative second font.

**The Thai Legibility Rule.** Never compress Thai text with tight letter spacing or line height. Long labels wrap rather than shrink below readable sizes.

## 4. Elevation

The system is layered with ambient shadows. Most cards remain flat with a border; shadows identify higher working layers such as soft analytical panels, floating map controls, sticky form actions, and mobile navigation. Every shadow is green-tinted where possible so it belongs to the field palette rather than looking like generic black elevation.

### Shadow Vocabulary

- **Ambient Panel** (`0 18px 45px rgba(0, 55, 34, 0.06)`): soft analytical containers on Field Mist.
- **Floating Control** (`0 12px 30px rgba(0, 40, 24, 0.14)`): map toolbars and controls that sit above spatial content.
- **Sticky Action** (`0 12px 35px rgba(0, 55, 34, 0.12)`): persistent form actions and consequential workflow controls.
- **Mobile Navigation** (`0 -10px 30px rgba(0, 55, 34, 0.08)`): bottom navigation only at widths below 980px.

### Named Rules

**The Working-Layer Rule.** A shadow must explain stacking or persistence. Flat content cards use a border; floating controls use a shadow. Never combine a decorative wide shadow with a decorative border.

## 5. Components

Components are sturdy and legible: compact enough for operational density, large enough for field use, and consistent across every page state.

### Buttons

- **Shape:** firm, gently curved controls (10px) with a minimum height of 46px.
- **Primary:** Pine Canopy with white, 800-weight text and `11px 20px` padding.
- **Hover / Focus:** shift to Pine Canopy Hover and move upward by no more than 1px over 180ms; use a visible Pine Canopy focus ring. Disabled buttons keep their size and drop to 50% opacity.
- **Secondary:** pale leaf surface with Pine Canopy text; identical shape, height, weight, and padding to primary buttons.

### Chips

- **Style:** full-pill geometry with a pale leaf surface, dark green text, and compact `6px 10px` padding.
- **State:** chips label field status or filters. Selected state may use Pine Canopy, but color must be accompanied by text.

### Cards / Containers

- **Corner Style:** consistent panel corners (14px; 12px on narrow mobile surfaces).
- **Background:** white for metrics, translucent white for elevated analytical panels, Pine Canopy for focused decision panels.
- **Shadow Strategy:** metric cards are flat with Field Border; only higher working layers receive ambient elevation.
- **Border:** a single quiet 1px field-green divider.
- **Internal Padding:** 16px for compact panels, 22px for metrics, and 28px for major decision panels.

### Inputs / Fields

- **Style:** white background, Field Border stroke, 10px corners, and `10px 12px` padding.
- **Focus:** Pine Canopy border with a `0 0 0 3px rgba(0, 63, 42, 0.12)` ring.
- **Error / Disabled:** red border and matching translucent ring for invalid data; pair the state with direct Thai error copy. Disabled fields must remain readable.

### Navigation

The desktop shell uses a 280px Sidebar Mist rail. Navigation items use 8px corners, 700-weight text, and `13px 18px` padding; hover and active states share Pine Canopy with white text. Below 980px the rail becomes a fixed five-item bottom navigation with icon-plus-label controls and a 56px minimum height.

### Field Intelligence Panels

Maps and charts are work surfaces, not decoration. Map legends use a translucent white overlay only to preserve geographic context; tool controls are 38–46px squares with 9–12px corners. Risk rings use Pine Canopy, Harvest Olive, and Risk Red with explicit adjacent labels.

## 6. Do's and Don'ts

### Do:

- **Do** lead each dashboard surface with the plots, risks, and actions that need attention now.
- **Do** use Pine Canopy for structure and primary actions, and reserve Harvest Gold for high-value attention.
- **Do** keep controls consistent: 10px corners, at least 46px tall for primary workflow buttons, and 160–180ms state feedback.
- **Do** pair every risk, health, and confidence color with explicit Thai text or a recognizable symbol.
- **Do** use borders for flat data cards and ambient green-tinted shadows only for true working layers.
- **Do** present AI confidence and data freshness honestly beside the recommendation they qualify.

### Don't:

- **Don't** make the dashboard resemble an overly technical AI console; model internals remain progressive, secondary information.
- **Don't** make it resemble a generic corporate administration template; agricultural context and field decisions must shape the hierarchy.
- **Don't** make it resemble a playful consumer app; avoid novelty controls, decorative illustrations, and frivolous motion.
- **Don't** use Harvest Gold as broad decoration or use Risk Red for anything other than risk and error.
- **Don't** rely on color alone, use gradient text, add colored side-stripe borders, or introduce glassmorphism outside functional map overlays.
- **Don't** proliferate card grids when a table, list, map, or direct grouping communicates operational relationships better.
