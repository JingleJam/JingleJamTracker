/*
    Search box for causes, campaigns and team events, used by the /home page, the /tv page and the toolbar search buttons

    JingleJamSearch.create(element, options) fills the element with a search input and a results list
    (createOverlay() shows one over the page, and getPageUrl() gives the tracker page for a result):
        options.domain      API domain ('' for the same site)
        options.getUrl      (result) => the URL to open for a result, where result.type is 'cause', 'campaign' or 'team_event'
        options.onEscape    Called when Escape is pressed in an empty search
        options.autofocus   Focus the input straight away
*/
window.JingleJamSearch = (function () {
    const MIN_LENGTH = 2;           //Shortest search sent to the API
    const DEBOUNCE_MS = 250;        //Wait for typing to pause before searching
    const CAMPAIGN_LIMIT = 8;       //Number of campaigns and team events shown
    const EVENT_SLUG = 'jingle-jam';

    function create(element, options) {
        const domain = options.domain || '';
        let causes = null;
        let conversion = null;
        let results = [];
        let highlighted = -1;
        let searchId = 0;
        let timeout = null;

        element.classList.add('jj-search');
        element.innerHTML = `
            <div class="jj-search-input-wrap">
              <i class="search icon"></i>
              <input class="jj-search-input" type="search" placeholder="Search causes, campaigns and team events" autocomplete="off" spellcheck="false" aria-label="Search causes, campaigns and team events">
              <div class="jj-search-spinner" hidden></div>
            </div>
            <div class="jj-search-results" role="listbox" hidden></div>`;

        const input = element.querySelector('.jj-search-input');
        const list = element.querySelector('.jj-search-results');
        const spinner = element.querySelector('.jj-search-spinner');

        loadCauses();

        input.addEventListener('input', () => {
            clearTimeout(timeout);
            timeout = setTimeout(search, DEBOUNCE_MS);
        });

        input.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                e.preventDefault();
                if (results.length > 0) {
                    highlighted = (highlighted + (e.key === 'ArrowDown' ? 1 : -1) + results.length) % results.length;
                    updateHighlight();
                }
            }
            else if (e.key === 'Enter') {
                let result = results[Math.max(highlighted, 0)];
                if (result) {
                    e.preventDefault();
                    window.location.href = options.getUrl(result);
                }
            }
            else if (e.key === 'Escape') {
                if (input.value) {
                    input.value = '';
                    search();
                }
                else if (options.onEscape) {
                    options.onEscape();
                }
            }
        });

        //The results drop down over the page, so close them when clicking elsewhere and reopen them on focus
        document.addEventListener('click', (e) => {
            if (!element.contains(e.target))
                list.hidden = true;
        });
        input.addEventListener('focus', () => {
            list.hidden = list.innerHTML.length === 0;
        });

        if (options.autofocus)
            input.focus();

        //Causes are few and rarely change, so they are loaded once and searched here
        async function loadCauses() {
            try {
                const response = await fetch(domain + '/api/causes');
                const data = await response.json();
                conversion = data.dollarConversionRate;
                causes = [{
                    type: 'cause',
                    id: EVENT_SLUG,
                    name: 'Jingle Jam',
                    subtitle: 'The whole event, every cause',
                    image: domain + '/assets/jingle-jam-2026-logo.webp',
                    color: '#e21251',
                    raised: null,
                }].concat(data.causes.map(cause => ({
                    type: 'cause',
                    id: cause.slug,
                    name: cause.name,
                    subtitle: 'Cause',
                    image: cause.borderedLogo || cause.logo,
                    color: cause.color,
                    raised: cause.raised,
                })));
            } catch {
                causes = [];
            }

            if (input.value.trim())
                search();
        }

        async function search() {
            let query = input.value.trim();
            let id = ++searchId;

            if (query.length < MIN_LENGTH) {
                spinner.hidden = true;
                show([], []);
                return;
            }

            let matchingCauses = (causes || []).filter(cause => matches(cause.name, query) || matches(cause.id, query));
            show(matchingCauses, null);

            spinner.hidden = false;
            let campaigns = [];
            try {
                const response = await fetch(`${domain}/api/campaigns?search=${encodeURIComponent(query)}&limit=${CAMPAIGN_LIMIT}&type=campaign,team_campaign,team_event`);
                const data = await response.json();
                conversion = data.dollarConversionRate || conversion;
                campaigns = (data.campaigns || []).map(campaign => ({
                    type: campaign.type === 'team_event' ? 'team_event' : 'campaign',
                    id: campaign.id,
                    name: campaign.name,
                    subtitle: getOwner(campaign),
                    image: campaign.type === 'team_event'
                        ? (campaign.team && campaign.team.avatar) || campaign.user.avatar
                        : campaign.user.avatar || (campaign.team && campaign.team.avatar),
                    raised: campaign.raised,
                    live: campaign.live,
                }));
            } catch { }

            //Ignore the response if a newer search has started
            if (id !== searchId)
                return;

            spinner.hidden = true;
            show(matchingCauses, campaigns);
        }

        //campaigns is null while the campaign search is still running
        function show(matchingCauses, campaigns) {
            results = matchingCauses.concat(campaigns || []);
            highlighted = results.length > 0 ? 0 : -1;

            let query = input.value.trim();
            if (query.length < MIN_LENGTH) {
                list.hidden = true;
                list.innerHTML = '';
                return;
            }

            let html = '';
            if (matchingCauses.length > 0)
                html += `<div class="jj-search-section">Causes</div>` + matchingCauses.map((result, index) => createResult(result, index)).join('');
            if (campaigns && campaigns.length > 0)
                html += `<div class="jj-search-section">Campaigns and team events</div>` + campaigns.map((result, index) => createResult(result, matchingCauses.length + index)).join('');
            if (campaigns && results.length === 0)
                html += `<div class="jj-search-empty">Nothing found for "${escapeHtml(query)}"</div>`;

            list.innerHTML = html;
            list.hidden = html.length === 0;
            updateHighlight();
        }

        function createResult(result, index) {
            let initial = escapeHtml((result.name || '?').trim().charAt(0).toUpperCase());
            let label = result.type === 'team_event' ? '<span class="jj-search-tag">Team event</span>' : '';
            let live = result.live ? '<span class="jj-search-tag jj-search-live">Live</span>' : '';
            let raised = typeof result.raised === 'number' ? `<div class="jj-search-raised">${escapeHtml(formatCurrency(result.raised))}</div>` : '';

            return `
                <a class="jj-search-result" href="${escapeHtml(options.getUrl(result))}" data-index="${index}" role="option">
                  <span class="jj-search-avatar jj-search-avatar-${result.type}" style="--result-color: ${escapeHtml(result.color || '#e21251')}">
                    <span>${initial}</span>
                    ${result.image ? `<img src="${escapeHtml(safeUrl(result.image))}" alt="" loading="lazy" onerror="this.remove()">` : ''}
                  </span>
                  <span class="jj-search-text">
                    <span class="jj-search-name">${escapeHtml(result.name)}</span>
                    <span class="jj-search-subtitle">${escapeHtml(result.subtitle)}${label}${live}</span>
                  </span>
                  ${raised}
                </a>`;
        }

        function updateHighlight() {
            list.querySelectorAll('.jj-search-result').forEach(item => {
                let active = Number(item.dataset.index) === highlighted;
                item.classList.toggle('active', active);
                if (active)
                    item.scrollIntoView({ block: 'nearest' });
            });
        }

        //Uses the currency picked on the tracker pages
        function formatCurrency(pounds) {
            let isPounds = localStorage.getItem('currency') !== 'false' || !conversion;
            let amount = Math.round(isPounds ? pounds : pounds * conversion);
            return (isPounds ? '£' : '$') + amount.toLocaleString('en-US');
        }

        return { input };
    }

    function getOwner(campaign) {
        if (campaign.type === 'team_event')
            return 'Team event by ' + ((campaign.team && campaign.team.name) || campaign.user.name);
        return campaign.user.name + (campaign.team ? ' · ' + campaign.team.name : '');
    }

    //Every word of the query appears in the text, ignoring case, accents and punctuation
    function matches(text, query) {
        let normalizedText = normalize(text);
        return normalize(query).split(' ').filter(Boolean).every(word => normalizedText.includes(word));
    }

    function normalize(text) {
        return String(text || '').normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
    }

    function escapeHtml(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    //Only allow http(s) and root-relative image links
    function safeUrl(url) {
        return /^(https?:\/\/|\/)/i.test(url || '') ? url : '';
    }

    //The tracker page for a search result
    function getPageUrl(result, domain = '') {
        if (result.type === 'cause')
            return domain + (result.id === EVENT_SLUG ? '/jingle-jam' : '/causes/' + encodeURIComponent(result.id));
        return domain + (result.type === 'team_event' ? '/team_events/' : '/campaigns/') + encodeURIComponent(result.id);
    }

    /*
        A search box over a dimmed page, used by the toolbar search buttons and the /tv page.
        Returns { open, close }. Options:
            domain, getUrl      As for create()
            hint                Text under the search box
            closable            Whether Escape and clicking the background close it (default true)
            full                Cover the page with a solid background instead of dimming it
            showHome            Show a link to the home page
    */
    function createOverlay(options) {
        const domain = options.domain || '';
        const closable = options.closable !== false;

        const overlay = document.createElement('div');
        overlay.className = 'jj-search-overlay' + (options.full ? ' jj-search-overlay-full' : '');
        overlay.hidden = true;
        overlay.innerHTML = `
            <div class="jj-search-overlay-panel" role="dialog" aria-label="Search">
              <img class="jj-search-overlay-logo" src="${escapeHtml(domain + '/assets/jingle-jam-2026-logo.webp')}" alt="Jingle Jam">
              <div class="jj-search-overlay-box"></div>
              ${options.hint ? `<div class="jj-search-overlay-hint">${escapeHtml(options.hint)}</div>` : ''}
              ${options.showHome ? `<a class="jj-search-overlay-home" href="${escapeHtml(domain + '/home')}"><i class="home icon"></i>Home</a>` : ''}
            </div>`;
        document.body.appendChild(overlay);

        const searchBox = create(overlay.querySelector('.jj-search-overlay-box'), {
            domain,
            getUrl: options.getUrl,
            onEscape: close,
        });

        function open() {
            overlay.hidden = false;
            document.body.classList.add('jj-search-open');
            searchBox.input.focus();
        }

        function close() {
            if (!closable)
                return;
            overlay.hidden = true;
            document.body.classList.remove('jj-search-open');
        }

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && !overlay.hidden)
                close();
        });

        //Clicking the dimmed background closes the search
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay)
                close();
        });

        return { open, close };
    }

    return { create, createOverlay, getPageUrl };
})();
