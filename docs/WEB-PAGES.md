# 🖥️ Web Pages

[← Back to README](../README.md) · [API](API.md) · [Architecture](ARCHITECTURE.md) · [Local Development](LOCAL-DEVELOPMENT.md)

The tracker pages are static HTML and jQuery in [website/](../website/). They call the [public API](API.md), animate the totals as they change, and update themselves every 10–15 seconds while the event is live.

| Page | URL | Data from |
|---|---|---|
| [Home](#home) | [`/home`](https://dashboard.jinglejam.co.uk/home) | `/api/v1/causes`, `/api/v1/campaigns?search=` |
| [Main tracker](#main-tracker) | [`/tracker`](https://dashboard.jinglejam.co.uk/tracker) | `/api/v1/event`, `/api/v1/timeline`, `/api/v1/timeline/history` |
| [Whole-event tracker](#whole-event-tracker) | [`/jingle-jam`](https://dashboard.jinglejam.co.uk/jingle-jam) | `/api/v1/event` |
| [Cause tracker](#cause-tracker) | [`/causes/{cause}`](https://dashboard.jinglejam.co.uk/causes/calm) | `/api/v1/causes/{cause}?limit=25` |
| [Campaign and team event tracker](#campaign-and-team-event-tracker) | `/campaigns/{id}` | `/api/v1/campaigns/{id}`, `/api/v1/causes` |
| [TV view](#tv-view) | [`/tv?type={type}&id={id}`](https://dashboard.jinglejam.co.uk/tv) | The same as the page it shows |
| [Totals only](#totals-only) | [`/total`](https://dashboard.jinglejam.co.uk/total) | `/api/v1/event` |

> [!NOTE]
> The screenshots below were taken locally with sample data from a previous event.

---

## Home

**[`/home`](https://dashboard.jinglejam.co.uk/home)**. The starting point for every page. Every other page links back to it with a **home icon** (🏠): next to the TV icon and currency switch on the cause, campaign and team event trackers, at the top left of the [main tracker](#main-tracker) (but not when it's embedded on jinglejam.co.uk), and beside the search button in the [TV view](#tv-view). Next to the home icon, a **search icon** (🔍) opens the same search over any page (home, then search, then TV on the cause, campaign and team event trackers; home then search on the main tracker). Picking a result opens its page, or in the TV view, shows it on the TV.

| Section | Shows |
|---|---|
| **Search** | Search causes, campaigns and team events by name. Campaigns are matched on the campaign, user and team names, and small typos are fine. Pick a result (or press **Enter** for the first one) to open its page. |
| **Tracker**, **Whole Event** and **TV View** | Links to the [main tracker](#main-tracker), the [whole-event tracker](#whole-event-tracker) and the [TV view](#tv-view) |
| **Causes** | Each cause's logo, linking to its [cause tracker](#cause-tracker) (hover a logo for the cause's name) |

---

## Main tracker

**`/tracker`**. This is the official tracker, also embedded on [jinglejam.co.uk/tracker](https://www.jinglejam.co.uk/tracker).

![Main tracker](images/main-tracker.png)

| Section | Shows |
|---|---|
| **Amount raised** | The event total, counting up as donations arrive. A green badge shows how much it rose since the last update. Before the event, this shows a countdown to the start. |
| **Collections** and **Donations** | Game collections claimed, and the total number of donations |
| **Average donation** | Amount raised ÷ number of donations |
| **Previous years** | Every year's final total since 2011, with a bar relative to the best year |
| **Charities** | Each cause with its logo, description and amount raised. Campaigns that support all causes are split equally between them. |
| **Raised by year** | This year's total over time plotted against every year since 2016, lined up by day of the event. Drag the slider to zoom into a range of days. |

---

## Whole-event tracker

**[`/jingle-jam`](https://dashboard.jinglejam.co.uk/jingle-jam)**. This is the [cause tracker](#cause-tracker) layout applied to the whole event: the event total, the top 25 campaigns across every cause, and a description listing all the causes. The page builds its "Jingle Jam" header from the [`/api/v1/event`](API.md#get-apiv1event) data.

![Whole-event tracker](images/event-tracker.png)

---

## Cause tracker

**`/causes/{cause}`**, e.g. [`/causes/calm`](https://dashboard.jinglejam.co.uk/causes/calm). Each cause has its own tracker, styled in the cause's colour.

![Cause tracker](images/cause-tracker.png)

| Section | Shows |
|---|---|
| **Raised for {cause}** | The cause's total, including its share of campaigns that support all causes |
| **Campaigns** | Number of campaigns dedicated to this cause |
| **Live now** | Number of those campaigns streaming right now |
| **Cause details** | Logo, description, and links to donate and to the cause's website |
| **Top campaigns** | The top 25 campaigns for this cause, with progress towards each goal and badges for **Live** and **Donation match** (e.g. 2× Match). Click a campaign to open it on Tiltify. |

The `{cause}` part of the URL is the cause's slug or Tiltify ID, the same values that [`/api/v1/causes/{cause}`](API.md#get-apiv1causescause) accepts. New causes get a page automatically. An unknown cause shows **Cause Not Found**.

| Cause | Tracker |
|---|---|
| Autistica | [`/causes/autistica`](https://dashboard.jinglejam.co.uk/causes/autistica) |
| Become | [`/causes/become`](https://dashboard.jinglejam.co.uk/causes/become) |
| CALM | [`/causes/calm`](https://dashboard.jinglejam.co.uk/causes/calm) |
| The Grand Appeal | [`/causes/the-grand-appeal`](https://dashboard.jinglejam.co.uk/causes/the-grand-appeal) |
| Make-A-Wish | [`/causes/make-a-wish`](https://dashboard.jinglejam.co.uk/causes/make-a-wish) |
| The Trevor Project | [`/causes/the-trevor-project`](https://dashboard.jinglejam.co.uk/causes/the-trevor-project) |
| War Child | [`/causes/war-child`](https://dashboard.jinglejam.co.uk/causes/war-child) |
| WWF | [`/causes/wwf`](https://dashboard.jinglejam.co.uk/causes/wwf) |

<sub>Causes change each year; this list is for the 2025 event. The current list is in `causes` from [`/api/v1/causes`](API.md#get-apiv1causes), and on the [home page](#home).</sub>

### On mobile

The cards stack into a single column, and each campaign's total and goal move below its name.

<img src="images/mobile.png" alt="Cause tracker on mobile" width="360">

---

## Campaign and team event tracker

**`/campaigns/{id}`** for a campaign, team campaign or team event. `{id}` is the Tiltify ID from [`/api/v1/campaigns`](API.md#get-apiv1campaigns), and the [home page](#home)'s search links to it. The page loads [`/api/v1/campaigns/{id}`](API.md#get-apiv1campaignsid) and shows the campaign or team event layout based on the `type` in the response. The page uses the cause tracker's layout, styled in the colour of the cause the fundraiser supports (Jingle Jam pink if it supports every cause).

| Section | Shows |
|---|---|
| **Raised by {owner}** | The fundraiser's total (with progress towards its goal in TV mode) |
| **Donation Match** and **Status** (campaigns) | The current match multiplier (e.g. 2×) with how much has been matched, and whether the campaign is live. In the [TV view](#tv-view), **Latest Donation** (the newest donation's amount and donor) takes Donation Match's place. |
| **Campaigns** and **Live Now** (team events) | Number of campaigns supporting the team event and the team's member count, and how many of those campaigns are live |
| **Goal** | The percentage of the goal raised, a progress bar, the amount raised against the goal, and how much is left (or **Goal reached**). Hidden when there's no goal. |
| **Details** | Avatar, name, the description on one line (hover it for the full text), then **{owner} | {cause logo}**: the user (or a team event's team) and the logo of the cause it supports, or the Jingle Jam logo if it supports every cause (hover the logo for the cause's name), and social media links (hover an icon to see the username or address; one that isn't a web address, usually a username, is copied when clicked). A **Donate** button opens the fundraiser on Tiltify, and a campaign links to its owner's Tiltify page. |
| **Team** / **Team event** | The team the fundraiser belongs to (opens the team on Tiltify), and the team event a campaign supports (opens the team event's tracker). Hidden when there are none. |
| **Donation Matches** | Each active match: who is matching, how much of their pledge has been used, and when it ends. Hidden when there are none. |
| **Campaigns** (team events) | Every campaign supporting the team event, in the same style as the cause tracker's top campaigns |
| **Top Donors** and **Latest Donations** | Side by side at the bottom of the page: the top 25 donors (each donor's donations added together; some fundraisers turn their donor leaderboard off on Tiltify, and the page says so), and the 25 most recent donations with each donor's comment |
| **Rewards** | The fundraiser's own rewards (not the Games Collection). Hidden when there are none. |

An unknown ID shows **Campaign Not Found**.

The live details (matches, rewards, donors, social links) come from Tiltify and can be up to 30 seconds old. See [`/api/v1/campaigns/{id}`](API.md#get-apiv1campaignsid).

---

## TV view

**`/tv?type={type}&id={id}`** shows a cause, campaign or team event full screen, for a TV, a big screen at an event, or a browser source in OBS.

| `type` | `id` | Example |
|---|---|---|
| `cause` | A cause's slug or ID, or `jingle-jam` for the whole event | [`/tv?type=cause&id=calm`](https://dashboard.jinglejam.co.uk/tv?type=cause&id=calm), [`/tv?type=cause&id=jingle-jam`](https://dashboard.jinglejam.co.uk/tv?type=cause&id=jingle-jam) |
| `campaign` | A campaign's, team campaign's or team event's ID | `/tv?type=campaign&id={id}` |

The TV icon (🖥) next to the currency switch on any cause, campaign or team event tracker opens that page's TV view. [`/tv`](https://dashboard.jinglejam.co.uk/tv) on its own opens the search, to pick what to show.

![TV view](images/tv-mode.png)

- The total is shown large, with the page's stat cards beside it.
- A ticker scrolls along the bottom: the top campaigns for a cause, and the top donors for a campaign or team event. If a team event has its donor leaderboard turned off, its campaigns scroll instead.
- Moving the mouse shows **home** and **search** buttons (top right). Search picks a different cause, campaign or team event to show, and **Esc** closes it. Home goes to the [home page](#home).
- The mouse cursor and the buttons hide after 3 seconds without mouse movement.

> [!TIP]
> The TV view fills the browser window but doesn't make the browser full screen. Press **F11** (or your browser's full screen shortcut) as well. For an OBS browser source, use the `/tv` URL with a 1920×1080 source size.

---

## Totals only

**[`/total`](https://dashboard.jinglejam.co.uk/total)**. Four unstyled lines with no layout: amount raised, collections, donations and average donation. It updates live like the other pages.

---

## Options and behaviour

These apply to every tracker page.

| Option | How |
|---|---|
| **Pounds or dollars** | The `$ / £` switch in the top right. Dollar amounts use the API's live `meta.dollarConversionRate`. The choice is saved in the browser and applies to every tracker page, the home page and the TV view. |

**Updating.** While the event is live, each page fetches new data about 15 seconds after the server's last refresh (never more often than every 5 seconds). The *Live* indicator spins while it fetches. Polling pauses while the tab is hidden and catches up when you come back. Before the event the pages show a countdown, and after it they show the final totals and stop polling.

**Embedding.** Each page is a small loader in [`pages/`](../website/pages/) that fetches an HTML fragment, its script and the stylesheet. That is how the official Jingle Jam website embeds the main tracker: it loads `/` (the main tracker fragment, [`index.html`](../website/index.html)), `/script.js` and `/style.css` directly, so those three URLs must keep working. When loaded on `jinglejam.co.uk`, `yogscast.com` or `squarespace.com`, the scripts call the API at `https://dashboard.jinglejam.co.uk`. A cause tracker picks its cause from a `data-cause` attribute on `#embedContainer` if one is set, and otherwise from the `/causes/{cause}` URL. A campaign tracker likewise uses `data-campaign` or `data-team-event`, and otherwise the URL. The TV view sets these attributes, plus `data-tv`.

> [!NOTE]
> Embedding the fragments is only supported on those official domains. To show Jingle Jam figures on your own site, build on the [API](API.md) or link to the tracker pages.

### Files

Each page is a loader in `pages/` → an HTML fragment → a script in `js/`.

| Page | Loader | Fragment | Script |
|---|---|---|---|
| `/tracker` | [`pages/tracker.html`](../website/pages/tracker.html) | [`index.html`](../website/index.html) (served at `/`) | [`js/tracker.js`](../website/js/tracker.js) (also served at `/script.js`) |
| `/home` | [`pages/home.html`](../website/pages/home.html) | [`fragments/home.html`](../website/fragments/home.html) | [`js/home.js`](../website/js/home.js) + [`js/search-box.js`](../website/js/search-box.js) |
| `/jingle-jam`, `/causes/{cause}` | [`pages/cause.html`](../website/pages/cause.html) | [`fragments/cause.html`](../website/fragments/cause.html) | [`js/cause.js`](../website/js/cause.js) |
| `/campaigns/{id}` | [`pages/campaign.html`](../website/pages/campaign.html) | [`fragments/campaign.html`](../website/fragments/campaign.html) | [`js/campaign.js`](../website/js/campaign.js) |
| `/tv` | [`pages/tv.html`](../website/pages/tv.html) | The cause or campaign fragment | The cause or campaign script, + [`js/search-box.js`](../website/js/search-box.js) |
| `/total` | [`pages/total.html`](../website/pages/total.html) | [`fragments/total.html`](../website/fragments/total.html) | [`js/total.js`](../website/js/total.js) |

| File | Role |
|---|---|
| [`css/style.css`](../website/css/style.css) | Styles for every page (also served at `/style.css`) |
| [`js/search-box.js`](../website/js/search-box.js) | The search box used by the home page and the TV view |
| [`_redirects`](../website/_redirects) | Serves each page URL from its loader, and `/script.js` and `/style.css` from their new locations |
| [`assets/`](../website/assets/) | Logo, favicon and the self-hosted Montserrat font |
| [`openapi.yaml`](../website/openapi.yaml) | The [API](API.md)'s OpenAPI spec, served at `/openapi.yaml` |
| [`pages/swagger.html`](../website/pages/swagger.html) | The API docs at `/swagger`: Swagger UI rendering `openapi.yaml`, with this site selected as the server for "Try it out" |

Third-party libraries are loaded from cdnjs: jQuery, Fomantic UI, and (main tracker only) Chart.js with Moment.js. Swagger UI (`/swagger` only) is loaded from jsDelivr.
