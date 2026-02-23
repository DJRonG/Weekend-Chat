# Dashboard Inspiration

Design references and UI/UX patterns we are borrowing for the Weekend Agent home dashboard.

---

## Reddit Inspiration Sources

### 1. r/homeassistant — "My HA Dashboard After 2 Years of Iteration"
**URL:** https://www.reddit.com/r/homeassistant/comments/1c6hgm9/my_ha_dashboard_after_2_years_of_iteration/

**Design elements we are borrowing:**
- **Dark glassmorphism card style** — translucent frosted-glass cards with subtle borders let sensor data breathe without visual clutter.
- **Status-ring icons** — each device/sensor shows a coloured ring (green/amber/red) that gives at-a-glance health without reading numbers.
- **Adaptive grid layout** — cards reflow from a 4-column desktop view down to single-column on mobile, keeping the same information hierarchy.
- **Micro-animation on state change** — a brief pulse animation when a sensor value crosses a threshold draws attention without being distracting.

---

### 2. r/homeassistant — "Minimalist Dashboard with Custom Button Cards"
**URL:** https://www.reddit.com/r/homeassistant/comments/1b8k4n2/minimalist_dashboard_with_custom_button_cards/

**Design elements we are borrowing:**
- **Icon-first button cards** — large centred icon, small label below; tapping toggles state. Works well for quick EV charge / garden water toggles in our Home Status panel.
- **Monochromatic accent palette** — uses a single hue (blue or amber) for active states and greyscale for inactive, preventing colour overload when many devices are shown.
- **Conditional visibility rules** — cards only appear when relevant (e.g. the "Rain incoming" banner only surfaces when precipitation probability > 40%).
- **Pill-shaped badges** — compact text pills for temperatures, percentages, and distances replace verbose labels and free up card real estate.

---

### 3. r/dashboards — "Unified Smart Home + Agenda View"
**URL:** https://www.reddit.com/r/dashboards/comments/1azqp9x/unified_smart_home_agenda_view_built_with_ha_and/

**Design elements we are borrowing:**
- **Split-panel "today at a glance" layout** — left half shows live home-state metrics (EV, weather, occupancy), right half shows today's calendar events and mobility recommendations side-by-side.
- **Timeline ribbon at the top** — a horizontal strip with time markers and coloured blocks for upcoming events anchors the user temporally without taking up a full card.
- **Confidence score visualisation** — Walk / Drive / Rideshare recommendations displayed as a three-segment horizontal bar where segment width encodes the confidence score for each mode.
- **Conversation-note snippet cards** — small excerpt cards surface the most recent Friday-recap note so context from the last agent conversation is always visible at a glance.

---

## Summary of Key Design Decisions

| Principle | Source | Applied to |
|-----------|--------|------------|
| Glassmorphism cards | Reddit #1 | All sensor/status cards |
| Status-ring health icons | Reddit #1 | EV charge, garden watering, home presence |
| Icon-first toggle buttons | Reddit #2 | Quick-action panel |
| Monochromatic active/inactive states | Reddit #2 | Entire dashboard colour system |
| Conditional card visibility | Reddit #2 | Weather alerts, parking warnings |
| Split home + agenda panel | Reddit #3 | Main dashboard layout |
| Timeline ribbon | Reddit #3 | Today's event strip |
| Confidence score bar | Reddit #3 | Mobility recommendation widget |
