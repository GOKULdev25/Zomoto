---
name: Premium AI Gastronomy
colors:
  surface: '#1e0f0f'
  surface-dim: '#1e0f0f'
  surface-bright: '#473534'
  surface-container-lowest: '#180a0a'
  surface-container-low: '#271717'
  surface-container: '#2c1b1b'
  surface-container-high: '#372625'
  surface-container-highest: '#423030'
  on-surface: '#f9dcda'
  on-surface-variant: '#e4bebc'
  inverse-surface: '#f9dcda'
  inverse-on-surface: '#3e2c2b'
  outline: '#ab8987'
  outline-variant: '#5b403f'
  surface-tint: '#ffb3b1'
  primary: '#ffb3b1'
  on-primary: '#680011'
  primary-container: '#ff535a'
  on-primary-container: '#5b000e'
  inverse-primary: '#bb162c'
  secondary: '#ffb59d'
  on-secondary: '#5d1900'
  secondary-container: '#b83900'
  on-secondary-container: '#ffddd2'
  tertiary: '#71d7cf'
  on-tertiary: '#003734'
  tertiary-container: '#32a099'
  on-tertiary-container: '#00302d'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#ffdad8'
  primary-fixed-dim: '#ffb3b1'
  on-primary-fixed: '#410007'
  on-primary-fixed-variant: '#92001c'
  secondary-fixed: '#ffdbd0'
  secondary-fixed-dim: '#ffb59d'
  on-secondary-fixed: '#390c00'
  on-secondary-fixed-variant: '#832600'
  tertiary-fixed: '#8ef4eb'
  tertiary-fixed-dim: '#71d7cf'
  on-tertiary-fixed: '#00201e'
  on-tertiary-fixed-variant: '#00504c'
  background: '#1e0f0f'
  on-background: '#f9dcda'
  surface-variant: '#423030'
typography:
  hero-display:
    fontFamily: Inter
    fontSize: 56px
    fontWeight: '800'
    lineHeight: '1.1'
    letterSpacing: -2px
  hero-display-mobile:
    fontFamily: Inter
    fontSize: 40px
    fontWeight: '800'
    lineHeight: '1.1'
    letterSpacing: -1.5px
  headline-lg:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '700'
    lineHeight: '1.2'
    letterSpacing: -0.5px
  headline-md:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: '1.3'
  body-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '400'
    lineHeight: '1.6'
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.5'
  label-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '500'
    lineHeight: '1'
    letterSpacing: 0.02em
  label-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '600'
    lineHeight: '1'
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  base: 4px
  xs: 8px
  sm: 16px
  md: 24px
  lg: 48px
  xl: 80px
  container-max: 1280px
  gutter: 24px
---

## Brand & Style
The design system targets a sophisticated, tech-savvy audience that values both culinary excellence and high-performance digital tools. The brand personality is **exclusive, intelligent, and sensory**.

The visual style is a fusion of **Luxury SaaS (Minimalism)** and **Glassmorphism**. It utilizes the "Dark UI" patterns popularized by industry leaders like Linear and Vercel—characterized by deep blacks, subtle gradients, and high-precision typography—but infuses the warmth of high-end dining through vibrant accent colors and blurred glass textures. The emotional response should be one of "effortless discovery" within a curated, premium environment.

## Colors
The palette is built on a "Void" foundation to allow high-quality food photography and AI insights to pop. 

- **Primary Accent (#E23744):** Used for critical actions, brand presence, and focus states. It retains the energy of the food industry.
- **Secondary Accent (#FF6B35):** Used for highlights, rating systems, and warm AI-driven suggestions.
- **Surface Layering:** Surfaces use a semi-transparent white (4%) to create a "smoke-on-glass" effect, ensuring depth without breaking the dark aesthetic.

## Typography
This design system relies on **Inter** for its systematic, utilitarian, and clean properties. 

- **Hero & Headlines:** Use tight letter-spacing and heavy weights to create an editorial, high-impact feel. 
- **Body Text:** Maintains generous line-heights (1.5 - 1.6) for maximum readability against dark backgrounds. 
- **Scale:** For mobile displays, hero sizes must scale down to prevent awkward word breaks, while maintaining the signature ExtraBold weight.

## Layout & Spacing
The layout follows a **Fluid Grid** model with a maximum container width of 1280px for desktop.

- **Grid:** Use a 12-column grid for desktop and a 4-column grid for mobile.
- **Rhythm:** Spacing follows a 4px/8px incremental scale. Use `lg` (48px) and `xl` (80px) for vertical section breathing room to maintain the premium, spacious feel.
- **Safe Areas:** Horizontal margins on mobile should be a minimum of 20px to prevent content from touching screen edges.

## Elevation & Depth
Depth is communicated through **Glassmorphism** and subtle **Tonal Layering** rather than traditional heavy shadows.

- **The Glass Effect:** Apply `backdrop-filter: blur(16px)` to all primary surfaces. This creates a sense of physical material floating over the background.
- **Borders:** Surfaces are defined by 1px solid borders using `rgba(255, 255, 255, 0.08)`. This "inner glow" or "ghost border" provides structure without the weight of shadows.
- **Interaction Depth:** On hover, card surfaces should increase in opacity (from 4% to 8%) or gain a subtle outer glow using the primary accent color at very low opacity (10-15%).

## Shapes
The design system uses a **Rounded (Level 2)** approach for structural elements to maintain a balance between professional SaaS and friendly lifestyle apps.

- **Standard Elements:** Buttons and Input fields use a 0.5rem (8px) radius.
- **Large Elements:** Cards and Modals use a 1rem (16px) radius to emphasize the "glass plate" feel.
- **Pill Elements:** Specific UI tokens like Badges, Tags, and Chips use a fully rounded (999px) radius to distinguish them from actionable containers.

## Components
- **Buttons:** Primary buttons use a solid `#E23744` fill with white text. Secondary buttons should be transparent with a 1px border and a subtle glass blur.
- **Cards:** Must feature the glassmorphism style. Background images (restaurant photos) should have a dark linear gradient overlay (bottom to top) to ensure text legibility.
- **Input Fields:** Use a dark, semi-transparent background. On focus, the border transitions to Primary Red with a subtle outer glow (0px 0px 8px rgba(226, 55, 68, 0.3)).
- **Chips/Badges:** Pill-shaped. Use subtle background tints related to the category (e.g., a faint orange for "Trending" or green for "Open Now").
- **AI Recommendation Engine:** Use a "Sparkle" icon and the Secondary Accent (#FF6B35) to denote AI-generated content.
- **Animations:** Implement staggered entrance animations for list items. Elements should "float up" (Y-axis: 10px to 0px) with an opacity transition (0 to 1) and a duration of 400ms using a `cubic-bezier(0.16, 1, 0.3, 1)` easing.