# RSS Widget

The RSS Widget allows users to display and read RSS feeds directly on their Boxento dashboard.

## Features

- Display RSS feeds from any public URL
- Three display modes: List, Cards, and Compact
- Responsive layout that adapts to different widget sizes
- Configurable display options for images, dates, authors, and descriptions
- Automatic extraction of images from feed items
- CORS proxy for accessing RSS feeds from any source
- Support for feed titles and item metadata

## Usage

1. Add the RSS Widget to your dashboard
2. Click the settings (gear) icon to configure the widget
3. Enter the URL of an RSS feed
4. Customize display settings as needed
5. Save your changes

## Configuration Options

| Option | Description |
|--------|-------------|
| Widget Title | Custom title to display in the widget header (if left empty, uses feed title) |
| RSS Feed URL | URL of the RSS feed to display |
| Maximum Items | Number of feed items to display (1-20) |
| Display Mode | Choose between List, Cards, or Compact view |
| Show Images | Whether to show images in feed items |
| Show Publication Dates | Whether to show item publication dates |
| Show Authors | Whether to show item authors |
| Show Descriptions | Whether to show item descriptions/excerpts |
| Open Links in New Tab | Whether links open in a new browser tab |

## Display Modes

The RSS Widget supports three display modes:

- **List**: Shows items in a vertical list with optional images on the left
- **Cards**: Shows items as cards with images at the top (good for visual feeds)
- **Compact**: Shows only titles and dates in a minimal view (best for small widgets)

## Responsive Behavior

The widget automatically adapts to different sizes:

- In small 2x2 widgets, it always uses the Compact mode regardless of settings
- For larger widgets, it uses the selected display mode
- List and Card views adjust their layouts based on available space

## Example Feeds

You can use these example feeds to test the widget:

- Hacker News: `https://news.ycombinator.com/rss`
- Cloudflare Blog: `https://blog.cloudflare.com/rss/`
- Krebs on Security: `https://krebsonsecurity.com/feed/`

## Technical Details

The widget uses a CORS proxy to fetch RSS feeds from any source, parses the XML, and extracts all relevant information. For link-only feeds, the same proxy can fetch the original article and run a reader-mode extraction pass so the app view can render readable inline content instead of an empty pane.
