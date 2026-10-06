(function () {
    let JingleJam = {
        model: null,
        oldModel: null,
        fundraiserId: null,
        notFound: false,
        causes: {},                 //Causes by id, for the cause logo and the number of causes
        refreshTime: 10000,         //How often to wait for an API refresh
        waitTime: 5000,             //How long to wait for the data on the backend to be updated
        minRefreshTime: 5000,       //Minimum refresh time for the API
        pageIsVisible: true,
        tvPage: false,              //Whether this is the /tv page, which is always in TV mode
        tvControlsTimeout: null,
        tvTickerSpeed: 16,          //Seconds for the TV ticker to scroll one screen width
        domain: '',                 //Root-relative, since the page is served at /campaigns/<id>
        settings: {
            isPounds: true,
        },
        timeLeft: null,
        isTeamEvent: function () {
            return !!JingleJam.model && JingleJam.model.fundraiser.type === 'team_event';
        },
        isLive: function () {
            return !JingleJam.isWaiting() && !JingleJam.hasEnded();
        },
        isWaiting: function () {
            return new Date() <= JingleJam.model.meta.event.startsAt;
        },
        hasEnded: function () {
            return new Date() >= JingleJam.model.meta.event.endsAt;
        }
    };

    //Icon and display name for each social link
    const SOCIAL_LINKS = {
        twitch: { icon: 'twitch', name: 'Twitch' },
        youtube: { icon: 'youtube', name: 'YouTube' },
        tiktok: { icon: 'tiktok', name: 'TikTok' },
        twitter: { icon: 'twitter', name: 'X / Twitter' },
        instagram: { icon: 'instagram', name: 'Instagram' },
        facebook: { icon: 'facebook', name: 'Facebook' },
        discord: { icon: 'discord', name: 'Discord' },
        snapchat: { icon: 'snapchat ghost', name: 'Snapchat' },
        linkedin: { icon: 'linkedin', name: 'LinkedIn' },
        website: { icon: 'globe', name: 'Website' },
    };

    //On page setup
    async function onLoad() {
        beforeLoadSetup();

        //Start loops
        if (JingleJam.fundraiserId) {
            await loadCauses();
            await tiltifyLoop();
        }

        if (JingleJam.model) {
            afterLoadSetup();
            hideLoader();

            //Start the timed loop
            timedLoop();
        }
        else {
            if (!JingleJam.fundraiserId || JingleJam.notFound) {
                $('#embedContainer #errorMessage').text('Campaign Not Found');
            }
            $('#loader').hide();
            $('#embedContainer #error').show();
        }
    };

    //Runs before the initial data is loaded
    function beforeLoadSetup() {
        //Get the currency stored in session
        JingleJam.settings.isPounds = localStorage.getItem('currency') !== 'false';

        //Check checkbox if the isPounds
        if (JingleJam.settings.isPounds) {
            $('#currencyCheckbox').attr('checked', 'checked')
        }

        //Domain lookup
        if (window.location.hostname.includes('jinglejam.co.uk') ||
            window.location.hostname.includes('squarespace.com') ||
            window.location.hostname.includes('yogscast.com'))
            JingleJam.domain = 'https://dashboard.jinglejam.co.uk';

        //Fundraiser lookup, from the embed container or the /campaigns/<id> URL
        JingleJam.fundraiserId = getFundraiserId();

        //The /tv page loads this page with a data-tv attribute
        JingleJam.tvPage = $('#embedContainer').is('[data-tv]');

        //Enable the updating live spinner
        setUpdatingLiveSpinner(true);
    }

    //Runs after the initial data is loaded
    function afterLoadSetup() {
        JingleJam.timeLeft = getTimeLeft();

        //Setup components
        setupComponents();

        //Replace HTML components with model data
        setFundraiserDetails();

        //Set the data on load
        updateCounts();

        //The /tv page is always in TV mode, other pages link to it
        if (JingleJam.tvPage) {
            enterTvMode();
        }
        else {
            $('#tvModeButton').attr('href', getTvUrl());
        }

        //Position the change counter after counts are updated
        setTimeout(positionChangeCounter, 100);
    }

    //Gets the campaign or team event to load
    function getFundraiserId() {
        let container = $('#embedContainer');
        if (container.attr('data-campaign'))
            return container.attr('data-campaign');

        let match = window.location.pathname.match(/^\/campaigns\/([^/]+)\/?$/i);
        if (!match)
            return null;

        try {
            return decodeURIComponent(match[1]);
        } catch {
            return null;
        }
    }

    //The /tv page for this campaign or team event
    function getTvUrl() {
        return JingleJam.domain + '/tv?type=campaign&id=' + encodeURIComponent(JingleJam.fundraiserId);
    }

    //Loop to update data on the page as needed
    function timedLoop() {
        setInterval(function () {
            mainComponent();
        }, 1000);
        mainComponent();
    }

    function mainComponent() {
        //Remove the Live Updating Row if no longer updating live
        toggleLiveRow();

        //Time Left Calculations
        JingleJam.timeLeft = getTimeLeft();
        if (!JingleJam.isWaiting() || JingleJam.timeLeft.totalTime < 0) {
            $('[data-status]').attr('data-status', 'live')
            $('#mainCounterHeader').html('<i class="money icon"></i>Raised By ' + escapeHtml(getOwnerName(JingleJam.model.fundraiser)));
            if ($('#mainCounter').text().includes('h')) {
                updateCounts(true);
            }
        }
        else {
            $('[data-status]').attr('data-status', 'countdown')
            $('#embedContainer #mainCounter').html(JingleJam.timeLeft.days + '<span class="countdown-label">d</span> ' + JingleJam.timeLeft.hours + '<span class="countdown-label">h</span> ' + JingleJam.timeLeft.minutes + '<span class="countdown-label">m</span> ' + JingleJam.timeLeft.seconds + '<span class="countdown-label">s</span> ');
            $('#mainCounterHeader').html('<i class="clock icon"></i>Countdown to ' + JingleJam.model.meta.event.year);
        }
    }

    //Gets the current time left until the JingleJame starts
    function getTimeLeft() {
        var now = new Date().getTime();
        var totalTime = JingleJam.model.meta.event.startsAt - now;

        var days = Math.floor(totalTime / (1000 * 60 * 60 * 24));
        var hours = Math.floor((totalTime % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        var minutes = Math.floor((totalTime % (1000 * 60 * 60)) / (1000 * 60));
        var seconds = Math.floor((totalTime % (1000 * 60)) / 1000);

        hours = String(hours).padStart(2, '0');
        minutes = String(minutes).padStart(2, '0');
        seconds = String(seconds).padStart(2, '0');

        return {
            seconds,
            minutes,
            hours,
            days,
            totalTime
        }
    }

    //Hide the main page loader
    function hideLoader() {
        $('#loader').hide();
        $('#trackerContent').show();
    }

    //Toggle the Live Row
    function toggleLiveRow() {
        if (!JingleJam.isLive()) {
            $('#liveUpdatingRow').parent().addClass('hide-live-update');
        }
        else {
            $('#liveUpdatingRow').parent().removeClass('hide-live-update');
        }
    }

    //Toggles the updating live spinner
    function setUpdatingLiveSpinner(bool) {
        if (bool) {
            $('#liveUpdatingRow .loader').show();
            $('#liveUpdatingRow .loading-circle').hide();
        }
        else {
            $('#liveUpdatingRow .loader').hide();
            $('#liveUpdatingRow .loading-circle').show();
        }
    }

    //Fetchs an endpoint with a required timeout
    async function fetchWithTimeout(resource, timeout = 5000) {
        const controller = new AbortController();
        const fetchId = setTimeout(() => controller.abort(), timeout);
        const response = await fetch(resource, {
            signal: controller.signal
        });
        clearTimeout(fetchId);
        return response;
    }

    //Setup components on the page
    function setupComponents() {
        //Event when the currency checkbox is toggled
        $('#currencyCheckbox').checkbox({
            onChange: function () {
                JingleJam.settings.isPounds = $('#currencyCheckbox').is(':checked');
                localStorage.setItem('currency', JingleJam.settings.isPounds);

                updateCounts(true);
                setTimeout(positionChangeCounter, 100);
            }
        });

        //Social usernames that aren't links are copied on click
        $('#fundraiserSocial').on('click', '.campaign-social-copy', function () {
            copySocial(this);
        });

        //TV mode
        setupTvMode();

        //Handle when tabbed out of the page
        let hidden;
        let visibilityChange;
        if (typeof document.hidden !== "undefined") { // Opera 12.10 and Firefox 18 and later support
            hidden = "hidden";
            visibilityChange = "visibilitychange";
        } else if (typeof document.msHidden !== "undefined") {
            hidden = "msHidden";
            visibilityChange = "msvisibilitychange";
        } else if (typeof document.webkitHidden !== "undefined") {
            hidden = "webkitHidden";
            visibilityChange = "webkitvisibilitychange";
        }

        if (typeof document.addEventListener === "undefined" || hidden === undefined) {
        } else {
            document.addEventListener(visibilityChange, function () {
                JingleJam.pageIsVisible = !document[hidden];

                //If the loops are not active, ignore this
                if (!JingleJam.isLive())
                    return;

                //If tab is back in focus and the screen did not refresh, refresh it after 1 second
                setTimeout(function () {
                    if (!JingleJam.model.meta.updatedAt || (new Date() - new Date(JingleJam.model.meta.updatedAt)) > (JingleJam.refreshTime + JingleJam.waitTime)) {
                        updateModel();
                    }
                }, 1000);
            }, false);
        }
    }

    //Setup TV mode for the /tv page (TV mode fills the window, it does not make the browser fullscreen)
    function setupTvMode() {
        //Only show the cursor while the mouse is moving
        $(document).on('mousemove touchstart', () => {
            if (isTvMode())
                showTvControls();
        });

        //Rebuild the ticker to fit the new screen size
        let resizeTimeout = null;
        $(window).on('resize', () => {
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(() => {
                if (isTvMode())
                    updateTicker(true);
                positionChangeCounter();
            }, 200);
        });
    }

    function isTvMode() {
        return $('#embedContainer').hasClass('tv-mode');
    }

    function enterTvMode() {
        $('#embedContainer').addClass('tv-mode');
        document.documentElement.classList.add('jj-tv-mode');

        showTvControls();
        updateTicker(true);
        setTimeout(positionChangeCounter, 100);
    }

    function showTvControls() {
        $('#embedContainer').addClass('tv-controls-visible');
        clearTimeout(JingleJam.tvControlsTimeout);
        JingleJam.tvControlsTimeout = setTimeout(() => {
            $('#embedContainer').removeClass('tv-controls-visible');
        }, 3000);
    }

    //What the TV ticker shows: the top donors, or a team event's campaigns when its donor leaderboard is turned off
    function getTickerMode() {
        if (JingleJam.model.topDonors !== null)
            return 'donors';
        return JingleJam.isTeamEvent() ? 'campaigns' : 'none';
    }

    //Creates or updates the scrolling TV ticker
    function updateTicker(force = false) {
        if (!isTvMode())
            return;

        let mode = getTickerMode();
        let items = mode === 'donors' ? JingleJam.model.topDonors : mode === 'campaigns' ? JingleJam.model.campaigns.items : [];
        let track = $('#tvTickerTrack');

        $('#tvTickerIcon').attr('class', (mode === 'campaigns' ? 'flag' : 'trophy') + ' icon');
        $('#tvTickerLabel').html(mode === 'campaigns' ? 'Top<br>Campaigns' : 'Top<br>Donors');
        $('#tvTickerEmpty')
            .text(mode === 'none' ? 'This campaign has its top donors turned off.' : mode === 'donors' ? 'No donations yet.' : 'No campaigns are supporting this team event yet.')
            .toggle(items.length === 0);

        //Rebuild when the items or their order changed (or the screen size changed), otherwise update the values in place
        let ids = mode + ':' + items.map(x => x.id || x.name).join(',');
        if (force || track.attr('data-ids') !== ids) {
            track.attr('data-ids', ids);

            let set = items.map((item, index) => mode === 'donors' ? createDonorTickerItem(item, index) : createTickerItem(item, index)).join('');
            track.html(set);

            //Repeat the items enough times to always fill the screen, then scroll by exactly one set so it loops seamlessly
            let setWidth = track[0].scrollWidth;
            let windowWidth = track.parent().width();
            if (setWidth > 0) {
                let copies = Math.max(2, Math.ceil(windowWidth / setWidth) + 1);
                track.html(set.repeat(copies));

                track[0].style.setProperty('--ticker-distance', `-${setWidth}px`);
                track[0].style.setProperty('--ticker-duration', `${(setWidth / windowWidth) * JingleJam.tvTickerSpeed}s`);
            }
        }

        items.forEach((item, index) => {
            let elements = track.find(`.tv-campaign[data-index="${index}"]`);
            if (mode === 'donors') {
                elements.find('.tv-campaign-total').text(formatCurrency(toCurrency(item.amount)));
                return;
            }

            elements.find('.tv-campaign-total').text(formatCurrency(toCurrency(item.raised)));
            //LIVE sits next to the user name
            elements.find('.tv-campaign-live').html(createCampaignBadges({ live: item.live }));

            //Goal pill: the fill shows progress towards the goal, and turns green once it's reached
            if (item.goal > 0) {
                let goalMet = item.raised >= item.goal;
                let percentage = Math.floor((item.raised / item.goal) * 100);
                elements.find('.tv-campaign-goal')
                    .toggleClass('goal-met', goalMet)
                    .css('--goal-progress', Math.min(percentage, 100) + '%')
                    .html(`${goalMet ? '<i class="check circle icon"></i>' : ''}<span>${percentage}% of ${formatCurrency(toCurrency(item.goal), 0, false)}</span>`);
            }
        });
    }

    //Creates the HTML for a single campaign in the TV ticker
    function createTickerItem(campaign, index) {
        let owner = escapeHtml(campaign.user.name) + (campaign.team ? ' &middot; ' + escapeHtml(campaign.team.name) : '');
        let avatar = campaign.user.avatar || (campaign.team && campaign.team.avatar) || '';
        let initial = escapeHtml((campaign.user.name || campaign.name || '?').charAt(0).toUpperCase());

        return `
            <div class="tv-campaign" data-index="${index}">
              <div class="tv-campaign-avatar">
                <span class="campaign-avatar-initial">${initial}</span>
                ${avatar ? `<img src="${escapeHtml(safeUrl(avatar))}" alt="" onerror="this.remove()">` : ''}
                <span class="tv-campaign-rank">${index + 1}</span>
              </div>
              <div class="tv-campaign-content">
                <div class="tv-campaign-name">${escapeHtml(campaign.name)}</div>
                <div class="tv-campaign-owner"><span class="tv-campaign-owner-name">${owner}</span><span class="tv-campaign-live"></span></div>
                <div class="tv-campaign-meta">
                  <span class="tv-campaign-total"></span>
                  ${campaign.goal > 0 ? '<span class="tv-campaign-goal"></span>' : ''}
                </div>
              </div>
            </div>`;
    }

    //Creates the HTML for a single donor in the TV ticker
    function createDonorTickerItem(donor, index) {
        return `
            <div class="tv-campaign tv-donor" data-index="${index}">
              <div class="tv-campaign-avatar">
                <span class="campaign-avatar-initial">${escapeHtml(getInitial(donor.name))}</span>
                <span class="tv-campaign-rank">${index + 1}</span>
              </div>
              <div class="tv-campaign-content">
                <div class="tv-campaign-name">${escapeHtml(donor.name)}</div>
                <div class="tv-campaign-meta">
                  <span class="tv-campaign-total"></span>
                </div>
              </div>
            </div>`;
    }

    //Sets the fundraiser name, avatar, links and colours
    function setFundraiserDetails() {
        let fundraiser = JingleJam.model.fundraiser;
        //The full cause (for its logo) if the causes loaded, otherwise the campaign's own name and colour for it. Null for every cause.
        let cause = fundraiser.cause.id ? (JingleJam.causes[fundraiser.cause.id] || fundraiser.cause) : null;
        let isTeamEvent = JingleJam.isTeamEvent();

        $('#embedContainer').toggleClass('team-event-scope', isTeamEvent);
        document.title = fundraiser.name + ' - Jingle Jam Tracker';

        //The page can be embedded on other sites, so load the logo from the tracker's domain
        $('#jjLogo').attr('src', JingleJam.domain + '/assets/jingle-jam-2026-logo.webp');
        $('#jjLogoLink').attr('href', JingleJam.domain + '/home');
        $('#homeButton').attr('href', JingleJam.domain + '/home');
        setupSearchButton();

        $('.jj-year').text(JingleJam.model.meta.event.year);
        $('.jj-fundraiser-kind').text(isTeamEvent ? 'team event' : 'campaign');

        $('#fundraiserAvatar').html(createAvatar(getAvatarUrl(fundraiser), getInitial(fundraiser.name)));
        $('#fundraiserName').text(fundraiser.name);
        //The description on one line (the full text shows on hover), then the cause it supports
        $('#fundraiserDescription').text(fundraiser.description || '').attr('title', fundraiser.description || '').toggle(!!fundraiser.description);
        //"<owner> | <cause logo>", with the Jingle Jam logo for fundraisers supporting every cause (the logo's hover names the cause)
        let causeName = cause ? cause.name : getAllCausesText();
        let causeLogo = cause
            ? `<img src="${escapeHtml(safeUrl(cause.logo || cause.borderedLogo))}" alt="${escapeHtml(causeName)}" title="${escapeHtml(causeName)}" onerror="this.remove()">`
            : `<img src="${escapeHtml(JingleJam.domain + (JingleJam.tvPage ? '/assets/jingle-jam-logo.png' : '/assets/jingle-jam-2026-logo.webp'))}" alt="${escapeHtml(causeName)}" title="${escapeHtml(causeName)}">`;
        let owner = isTeamEvent ? getOwnerName(fundraiser) : fundraiser.user.name;
        //A team icon for a team event's team, otherwise a user icon (only shown in TV mode)
        let ownerIcon = `<i class="${isTeamEvent ? 'users' : 'user'} icon campaign-info-owner-icon" aria-hidden="true"></i>`;
        $('#fundraiserCause').html(`${ownerIcon}<span class="campaign-info-owner-name">${escapeHtml(owner)}</span><span class="campaign-info-separator" aria-hidden="true"></span>${causeLogo}`);
        $('#fundraiserDonateLink').attr('href', safeUrl(fundraiser.url));

        //The campaign owner's page on Tiltify (a team event's team has its own card instead)
        $('#fundraiserProfileLink').attr('href', safeUrl(fundraiser.user.url)).toggle(!isTeamEvent && !!fundraiser.user.url);
        $('#fundraiserProfileName').text(fundraiser.user.name + ' on Tiltify');

        setTeamCards(fundraiser);
        setSocialLinks(JingleJam.model.social);
        setCauseColors(cause && cause.color);
    }

    //e.g. "Raising for all 8 causes" (without the number if the causes couldn't be loaded)
    function getAllCausesText() {
        let count = Object.keys(JingleJam.causes).length;
        return count > 0 ? `Raising for all ${count} causes` : 'Raising for all causes';
    }

    //Cards for the team the fundraiser belongs to (its page on Tiltify) and the team event it supports (its tracker)
    function setTeamCards(fundraiser) {
        let cards = '';
        if (fundraiser.team) {
            cards += createTeamCard('Team', fundraiser.team, safeUrl(fundraiser.team.url), true, 'View team');
        }
        if (fundraiser.teamEvent) {
            cards += createTeamCard('Team event', fundraiser.teamEvent, JingleJam.domain + '/campaigns/' + encodeURIComponent(fundraiser.teamEvent.id), false, 'View team event');
        }
        $('#teamCards').html(cards).toggle(cards.length > 0);
    }

    function createTeamCard(label, team, url, external, action) {
        return `
            <a class="ui segment cause-info campaign-team-card" href="${escapeHtml(url)}"${external ? ' target="_blank" rel="noopener"' : ''}>
              <div class="campaign-avatar">${createAvatar(team.avatar, getInitial(team.name))}</div>
              <div class="cause-info-content">
                <div class="campaign-team-label">${escapeHtml(label)}</div>
                <div class="cause-info-name">${escapeHtml(team.name)}</div>
              </div>
              <div class="cause-link">${escapeHtml(action)}<i class="${external ? 'external alternate' : 'arrow right'} icon"></i></div>
            </a>`;
    }

    //The team running a team event or team campaign, otherwise the campaign's owner
    function getOwnerName(fundraiser) {
        return (fundraiser.team && fundraiser.team.name) || fundraiser.user.name;
    }

    function getAvatarUrl(fundraiser) {
        return JingleJam.isTeamEvent()
            ? (fundraiser.team && fundraiser.team.avatar) || fundraiser.user.avatar
            : fundraiser.user.avatar || (fundraiser.team && fundraiser.team.avatar);
    }

    function getInitial(name) {
        return (name || '?').trim().charAt(0).toUpperCase() || '?';
    }

    //Avatar image over its initial, which shows if there is no image or it fails to load
    function createAvatar(url, initial, icon = null) {
        if (icon)
            return `<i class="${icon} icon"></i>`;
        return `<span class="campaign-avatar-initial">${escapeHtml(initial)}</span>`
            + (url ? `<img src="${escapeHtml(safeUrl(url))}" alt="" loading="lazy" onerror="this.remove()">` : '');
    }

    //Shows an icon link for each social media link the fundraiser has set
    //Tiltify takes any text for these, so a value that isn't a web address (usually a username) is copied on click instead
    function setSocialLinks(social) {
        let links = Object.keys(SOCIAL_LINKS)
            .filter(key => social && social[key] && String(social[key]).trim())
            .map(key => {
                let value = String(social[key]).trim();
                let name = SOCIAL_LINKS[key].name;
                let icon = `<i class="${SOCIAL_LINKS[key].icon} icon"></i>`;
                let url = getSocialUrl(value);

                if (url)
                    return `<a href="${escapeHtml(url)}" target="_blank" rel="noopener" aria-label="${escapeHtml(name)}" data-tooltip="${escapeHtml(name + ': ' + value)}" data-position="top center" data-inverted="">${icon}</a>`;
                return `<button type="button" class="campaign-social-copy" data-copy="${escapeHtml(value)}" aria-label="${escapeHtml('Copy ' + name + ': ' + value)}" data-tooltip="${escapeHtml(name + ': ' + value + ' (click to copy)')}" data-position="top center" data-inverted="">${icon}</button>`;
            })
            .join('');

        //The TV page has no social links (showing them would override the CSS that hides them)
        setHtmlIfChanged('#fundraiserSocial', links);
        $('#fundraiserSocial').toggle(links.length > 0 && !JingleJam.tvPage);
    }

    //A full web address, or one without https:// (e.g. "discord.gg/abc" or "www.example.com"), otherwise null
    function getSocialUrl(value) {
        if (/^https?:\/\/\S+$/i.test(value))
            return value;
        if (/^(www\.)?[a-z0-9-]+(\.[a-z0-9-]+)+(\/\S*)?$/i.test(value))
            return 'https://' + value;
        return null;
    }

    //Copies a social username, briefly showing "Copied" in its tooltip
    function copySocial(button) {
        let value = button.getAttribute('data-copy');
        let tooltip = button.getAttribute('data-tooltip');
        let done = (text) => {
            button.setAttribute('data-tooltip', text);
            setTimeout(() => button.setAttribute('data-tooltip', tooltip), 1500);
        };

        if (navigator.clipboard && window.isSecureContext) {
            navigator.clipboard.writeText(value).then(() => done('Copied ' + value), () => done('Couldn\'t copy, select it: ' + value));
            return;
        }

        //Older browsers, and pages not served over https
        let input = document.createElement('textarea');
        input.value = value;
        input.style.position = 'fixed';
        input.style.opacity = '0';
        document.body.appendChild(input);
        input.select();
        let copied = false;
        try {
            copied = document.execCommand('copy');
        } catch { }
        input.remove();
        done(copied ? 'Copied ' + value : 'Couldn\'t copy, select it: ' + value);
    }

    //The toolbar's search opens over the page. The search box script isn't loaded when the page is embedded on other sites, so there's no search there.
    function setupSearchButton() {
        if (!window.JingleJamSearch || JingleJam.tvPage)
            return;

        let search = null;
        $('#searchButton').show().on('click', () => {
            search = search || JingleJamSearch.createOverlay({
                domain: JingleJam.domain,
                getUrl: result => JingleJamSearch.getPageUrl(result, JingleJam.domain),
                hint: 'Pick a cause, campaign or team event. Press Esc to close.',
            });
            search.open();
        });
    }

    //Themes the page with the cause colour, picking a readable text colour for it
    function setCauseColors(color) {
        let rgb = hexToRgb(color || '#e21251');
        let isDark = getLuminance(rgb) < 0.02;
        let isLight = getLuminance(rgb) > 0.4;

        //Near-black colours get lightened at the start of the gradient instead of darkened at the end
        let start = isDark ? shadeRgb(rgb, 0.25) : rgb;
        let end = isDark ? rgb : shadeRgb(rgb, -0.18);

        let container = document.getElementById('embedContainer');
        container.style.setProperty('--cause-rgb', `${rgb.r}, ${rgb.g}, ${rgb.b}`);
        container.style.setProperty('--cause-color', `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`);
        container.style.setProperty('--cause-gradient-start', `rgb(${start.r}, ${start.g}, ${start.b})`);
        container.style.setProperty('--cause-gradient-end', `rgb(${end.r}, ${end.g}, ${end.b})`);
        container.style.setProperty('--cause-text', isLight ? '#111111' : '#ffffff');

        //Accent text (e.g. amounts raised) needs to stay readable on a white background
        let accent = isLight ? shadeRgb(rgb, -0.45) : rgb;
        container.style.setProperty('--cause-accent', `rgb(${accent.r}, ${accent.g}, ${accent.b})`);
    }

    //Relative luminance of an RGB colour (0 = black, 1 = white)
    function getLuminance(rgb) {
        let channel = (c) => {
            c = c / 255;
            return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
        };
        return 0.2126 * channel(rgb.r) + 0.7152 * channel(rgb.g) + 0.0722 * channel(rgb.b);
    }

    //Lightens (positive amount) or darkens (negative amount) an RGB colour
    function shadeRgb(rgb, amount) {
        let shade = (c) => Math.round(amount < 0 ? c * (1 + amount) : c + (255 - c) * amount);
        return { r: shade(rgb.r), g: shade(rgb.g), b: shade(rgb.b) };
    }

    //Helper function to convert hex to RGB
    function hexToRgb(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : { r: 226, g: 18, b: 81 };
    }

    //Escapes text for use in HTML
    function escapeHtml(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    //Only allow http(s) links
    function safeUrl(url) {
        return /^https?:\/\//i.test(url || '') ? url : '#';
    }

    //Formats a currency value
    function formatCurrency(total, decimals = 0, includeSpace = true) {
        let neg = false;
        if (total < 0) {
            neg = true;
            total = Math.abs(total);
        }

        let currency = JingleJam.settings.isPounds ? '£' : '$';

        let amount = 0
        if (decimals > 0)
            amount = parseFloat(total).toFixed(decimals).replace(/(\d)(?=(\d{3})+\.)/g, "$1,").toString();
        else
            amount = parseInt(total).toLocaleString("en-US");

        return (neg ? ("-" + currency) : currency) + (includeSpace ? " " : "") + amount;
    }

    //Formats an integer value
    function formatInt(x) {
        return parseInt(x).toLocaleString();
    }

    //Formats a date as a short day and time, e.g. "Sun 22:00"
    function formatDayTime(value) {
        return new Date(value).toLocaleString([], { weekday: 'short', hour: 'numeric', minute: '2-digit' });
    }

    //Converts a pounds amount to the selected currency
    function toCurrency(pounds) {
        return JingleJam.settings.isPounds ? pounds : pounds * JingleJam.model.meta.dollarConversionRate;
    }

    //Animates a counter (targetPrimary = pounds, tagetSecondary = dollars for currency values)
    function animateCount(elem, format, targetPrimary, targetSecondary = null) {
        let number = parseFloat($(elem).data('value'));
        let target = targetSecondary === null ? targetPrimary : (JingleJam.settings.isPounds ? targetPrimary : targetSecondary)

        if (isNaN(number))
            number = 0;

        if (!target)
            target = 0;

        let index = 90;
        let diff = Math.abs(target - number);
        let startCurrency = JingleJam.settings.isPounds;

        let direction = 1;
        if(target < number)
            direction = -1;

        if (number !== target) {
            let interval = setInterval(function () {
                if ((direction === 1 && number >= target) || (direction === -1 && number <= target)
                || index === 300 || (startCurrency !== JingleJam.settings.isPounds)) {
                    if ((startCurrency !== JingleJam.settings.isPounds) && targetSecondary !== null) {
                        target = JingleJam.settings.isPounds ? targetPrimary : targetSecondary;
                    }
                    clearInterval(interval);
                    setCount(elem, target, format);

                    return;
                }
                else {
                    formatNumberText(elem, format(number));
                }
                number += direction * incAount(++index, diff)
            }, 20);
        }
        else {
            setCount(elem, target, format);
        }
    }

    //Formats a number counter so that it's displayed properly (for evenly-spaced text)
    function formatNumberText(ele, val) {
        let spans = '';
        for (let digit of val.toString().split('')) {
            let isComma = digit === ',' || digit === '.' || digit === '$' || digit === '£';
            spans += isComma ? `<span class="comma-value">${digit}</span>` : digit;
        }
        $(ele).html(spans);
    }

    //Calculates the increment amount for a animated number
    function incAount(x, diff) {
        let mean = 100;
        let std = 35;
        return Math.max((1.648 * calculateNormalDistribution(x, mean, std)) * diff, .03)
    }

    //Reset Animations
    function resetAnimation() {
        for(let el of document.getElementsByClassName('change-counter')){
            el.classList.remove('hide');
            el.style.animation = 'none';
            el.offsetHeight; /* trigger reflow */
            el.style.animation = null;
        }
        // Position the counter at the top-right of the value text
        positionChangeCounter();
    }

    //Position the change counter at the top-right of the value text
    function positionChangeCounter() {
        const valueElement = document.getElementById('mainCounter');
        const counterDiv = document.querySelector('.main-stat-card .change-counter-div');
        if(valueElement && counterDiv) {
            const valueRect = valueElement.getBoundingClientRect();
            const cardRect = valueElement.closest('.main-stat-card').getBoundingClientRect();
            //Keep the counter inside the card when the value nearly fills it (e.g. in TV mode)
            const counterWidth = counterDiv.getBoundingClientRect().width;
            const leftOffset = Math.min(valueRect.left - cardRect.left + valueRect.width + 5, cardRect.width - counterWidth - 16);
            const topOffset = valueRect.top - cardRect.top - 55;
            counterDiv.style.left = leftOffset + 'px';
            counterDiv.style.right = 'auto';
            counterDiv.style.top = topOffset + 'px';
            counterDiv.style.bottom = 'auto';
        }
    }

    //Calculates a normal distribution value
    function calculateNormalDistribution(x, mean, stdDev) {
        const variance = stdDev ** 2;
        const numerator = Math.exp(-((x - mean) ** 2) / (2 * variance));
        const denominator = Math.sqrt(2 * Math.PI * variance);
        return numerator / denominator;
    }

    //Sets the count of an object (including the data component)
    function setCount(elem, target, format) {
        $(elem).data('value', target);
        formatNumberText(elem, format(target))
    }

    //Replaces the HTML of an element only when it changed, so it doesn't flicker on every update
    function setHtmlIfChanged(elem, html) {
        let element = $(elem);
        if (element.attr('data-html') !== html) {
            element.attr('data-html', html);
            element.html(html);
        }
    }

    //Creates or updates the team event's campaigns list
    function updateCampaigns(instant = false) {
        if (!JingleJam.isTeamEvent())
            return;

        let campaigns = JingleJam.model.campaigns.items;
        let conversion = JingleJam.model.meta.dollarConversionRate;
        let list = $('#campaignList');

        $('#campaignsEmpty').toggle(campaigns.length === 0);

        //Rebuild the list when the campaigns or their order changed, otherwise update the values in place
        let ids = campaigns.map(x => x.id).join(',');
        if (list.attr('data-ids') !== ids) {
            //Keep the displayed amounts so moved campaigns animate from their previous value
            let previous = {};
            list.find('.campaign-item').each(function () {
                previous[$(this).attr('data-id')] = $(this).find('.raised-total').data('value');
            });

            list.html(campaigns.map((campaign, index) => createCampaignItem(campaign, index)).join(''));
            list.attr('data-ids', ids);

            campaigns.forEach((campaign, index) => {
                let elem = `#campaignList #campaignRaised${index}`;
                let value = previous[campaign.id];
                $(elem).data('value', (value === undefined || instant) ? toCurrency(campaign.raised) : value);
            });
        }

        campaigns.forEach((campaign, index) => {
            let elem = `#campaignList #campaignRaised${index}`;
            if (instant)
                setCount(elem, toCurrency(campaign.raised), formatCurrency);
            else
                animateCount(elem, formatCurrency, campaign.raised, campaign.raised * conversion);

            let item = $(`#campaignList .campaign-item[data-index="${index}"]`);
            item.find('.campaign-badges').html(createCampaignBadges(campaign));
            if (campaign.goal > 0) {
                let percentage = Math.min((campaign.raised / campaign.goal) * 100, 100);
                let goalMet = campaign.raised >= campaign.goal;
                item.find('.campaign-progress').toggleClass('goal-met', goalMet);
                item.find('.progress-bar-fill').css('width', percentage + '%');
                item.find('.campaign-goal').html((goalMet ? '<i class="check circle icon"></i>' : '') + escapeHtml(`${Math.floor((campaign.raised / campaign.goal) * 100)}% of ${formatCurrency(toCurrency(campaign.goal))} goal`));
            }
        });
    }

    //Creates the live and donation matching badges for a campaign
    function createCampaignBadges(campaign) {
        let badges = '';
        if (campaign.live)
            badges += '<span class="campaign-badge live"><i class="live-icon icon circle"></i>Live</span>';
        if (campaign.donationMatchMultiplier > 1)
            badges += `<span class="campaign-badge matching"><i class="handshake icon"></i>${formatInt(campaign.donationMatchMultiplier)}&times; Match</span>`;
        return badges;
    }

    //Creates the HTML for a single campaign in the list
    function createCampaignItem(campaign, index) {
        let owner = escapeHtml(campaign.user.name) + (campaign.team ? ' &middot; ' + escapeHtml(campaign.team.name) : '');
        let avatar = campaign.user.avatar || (campaign.team && campaign.team.avatar) || '';
        let initial = escapeHtml((campaign.user.name || campaign.name || '?').charAt(0).toUpperCase());

        return `
            <a class="campaign-item" href="${escapeHtml(safeUrl(campaign.url))}" target="_blank" rel="noopener" data-id="${escapeHtml(campaign.id)}" data-index="${index}">
              <div class="campaign-rank">${index + 1}</div>
              <div class="campaign-avatar">
                <span class="campaign-avatar-initial">${initial}</span>
                ${avatar ? `<img src="${escapeHtml(safeUrl(avatar))}" alt="" loading="lazy" onerror="this.remove()">` : ''}
              </div>
              <div class="campaign-content">
                <div class="campaign-name-row">
                  <div class="campaign-name">${escapeHtml(campaign.name)}</div>
                  <div class="campaign-badges"></div>
                </div>
                <div class="campaign-owner">${owner}</div>
              </div>
              ${campaign.goal > 0 ? `
              <div class="campaign-progress">
                <div class="progress-bar-track"><div class="progress-bar-fill"></div></div>
                <div class="campaign-goal"></div>
              </div>` : ''}
              <div class="campaign-total">
                <span class="raised-total" id="campaignRaised${index}"></span>
                <div class="raised-label">RAISED</div>
              </div>
            </a>`;
    }

    //Creates or updates the top donors list
    function updateDonors(instant = false) {
        let donors = JingleJam.model.topDonors;
        let conversion = JingleJam.model.meta.dollarConversionRate;
        let list = $('#donorList');

        let message = donors === null
            ? `This ${JingleJam.isTeamEvent() ? 'team event' : 'campaign'} has its top donors turned off on Tiltify.`
            : 'No donations yet.';
        $('#donorsEmpty').text(message).toggle(!donors || donors.length === 0);

        donors = donors || [];

        //Rebuild the list when the donors or their order changed, otherwise update the amounts in place
        let names = donors.map(x => x.name).join('\n');
        if (list.attr('data-names') !== names) {
            list.html(donors.map((donor, index) => createDonorItem(donor, index)).join(''));
            list.attr('data-names', names);
        }

        donors.forEach((donor, index) => {
            let elem = `#donorList #donorAmount${index}`;
            if (instant)
                setCount(elem, toCurrency(donor.amount), formatCurrency);
            else
                animateCount(elem, formatCurrency, donor.amount, donor.amount * conversion);
        });
    }

    //Creates the HTML for a single donor in the list
    function createDonorItem(donor, index) {
        return `
            <div class="campaign-item static-item no-progress" data-index="${index}">
              <div class="campaign-rank">${index + 1}</div>
              <div class="campaign-avatar">${createAvatar(null, getInitial(donor.name))}</div>
              <div class="campaign-content">
                <div class="campaign-name">${escapeHtml(donor.name)}</div>
              </div>
              <div class="campaign-total">
                <span class="raised-total" id="donorAmount${index}"></span>
                <div class="raised-label">DONATED</div>
              </div>
            </div>`;
    }

    //Shows the latest donations, newest first, with each donor's comment
    function updateLatestDonations() {
        let donations = JingleJam.model.latestDonations || [];
        $('#latestDonationsEmpty').toggle(donations.length === 0);

        setHtmlIfChanged('#latestDonationList', donations.map(donation => `
            <div class="campaign-item static-item no-rank no-progress latest-donation">
              <div class="campaign-avatar">${createAvatar(null, getInitial(donation.name))}</div>
              <div class="campaign-content">
                <div class="campaign-name">${escapeHtml(donation.name)}</div>
                ${donation.comment ? `<div class="campaign-owner" title="${escapeHtml(donation.comment)}">${escapeHtml(donation.comment)}</div>` : ''}
              </div>
              <div class="campaign-total">
                <span class="raised-total">${escapeHtml(formatCurrency(toCurrency(donation.amount)))}</span>
                <div class="raised-label">DONATED</div>
              </div>
            </div>`).join(''));
    }

    //Shows the active donation matches, with each sponsor's progress towards their pledge
    function updateMatches() {
        let matches = JingleJam.model.donationMatches || [];
        $('#matchesCard').toggle(matches.length > 0);

        setHtmlIfChanged('#matchList', matches.map(match => {
            let percentage = match.pledged > 0 ? Math.min((match.matched / match.pledged) * 100, 100) : 0;
            return `
            <div class="campaign-item static-item no-rank">
              <div class="campaign-avatar">${createAvatar(null, null, 'handshake')}</div>
              <div class="campaign-content">
                <div class="campaign-name">${escapeHtml(match.matchedBy)}</div>
                <div class="campaign-owner">${match.endsAt ? escapeHtml('Ends ' + formatDayTime(match.endsAt)) : 'Matching donations'}</div>
              </div>
              <div class="campaign-progress">
                <div class="progress-bar-track"><div class="progress-bar-fill" style="width: ${percentage}%"></div></div>
                <div class="campaign-goal">${escapeHtml(`${formatCurrency(toCurrency(match.matched))} of ${formatCurrency(toCurrency(match.pledged))} matched`)}</div>
              </div>
              <div class="campaign-total">
                <span class="raised-total">${escapeHtml(formatCurrency(toCurrency(match.pledged)))}</span>
                <div class="raised-label">PLEDGED</div>
              </div>
            </div>`;
        }).join(''));
    }

    //Shows the fundraiser's own rewards
    function updateRewards() {
        let rewards = JingleJam.model.rewards || [];
        $('#rewardsCard').toggle(rewards.length > 0);

        setHtmlIfChanged('#rewardList', rewards.map(reward => {
            let left = reward.remaining !== null && reward.quantity !== null
                ? `<span class="campaign-badge reward-remaining">${formatInt(reward.remaining)} of ${formatInt(reward.quantity)} left</span>`
                : '';
            return `
            <div class="campaign-item static-item no-rank no-progress">
              <div class="campaign-avatar">${reward.image ? createAvatar(reward.image, '') : createAvatar(null, null, 'gift')}</div>
              <div class="campaign-content">
                <div class="campaign-name-row">
                  <div class="campaign-name">${escapeHtml(reward.name)}</div>
                  <div class="campaign-badges">${left}</div>
                </div>
                ${reward.description ? `<div class="campaign-owner">${escapeHtml(reward.description)}</div>` : ''}
              </div>
              <div class="campaign-total">
                <span class="raised-total">${escapeHtml(formatCurrency(toCurrency(reward.amount)))}</span>
                <div class="raised-label">OR MORE</div>
              </div>
            </div>`;
        }).join(''));
    }

    //Shows the progress towards the fundraiser's goal under the amount raised
    function updateGoal() {
        let fundraiser = JingleJam.model.fundraiser;
        updateGoalCard(fundraiser);

        //TV mode has no room for the goal card, so it shows the progress under the amount raised instead
        let showGoal = fundraiser.goal > 0 && !JingleJam.isWaiting();
        $('#mainGoal').toggle(showGoal);
        if (!showGoal)
            return;

        let goalMet = fundraiser.raised >= fundraiser.goal;
        let percentage = Math.floor((fundraiser.raised / fundraiser.goal) * 100);
        $('#mainGoal').toggleClass('goal-met', goalMet);
        $('#mainGoalFill').css('width', Math.min(percentage, 100) + '%');
        $('#mainGoalText').html((goalMet ? '<i class="check circle icon"></i>' : '') + escapeHtml(`${formatInt(percentage)}% of ${formatCurrency(toCurrency(fundraiser.goal))} goal`));
    }

    //The goal card: percentage, progress bar, and how much is left to raise
    function updateGoalCard(fundraiser) {
        let hasGoal = fundraiser.goal > 0;
        $('#goalCard').toggle(hasGoal);
        if (!hasGoal)
            return;

        let goalMet = fundraiser.raised >= fundraiser.goal;
        let percentage = Math.floor((fundraiser.raised / fundraiser.goal) * 100);
        $('#goalCard').toggleClass('goal-met', goalMet);
        $('#goalPercent').text(formatInt(percentage) + '%');
        $('#goalFill').css('width', Math.min(percentage, 100) + '%');
        $('#goalRaised').text(`${formatCurrency(toCurrency(fundraiser.raised))} of ${formatCurrency(toCurrency(fundraiser.goal))}`);
        $('#goalRemaining').html(goalMet
            ? '<i class="check circle icon"></i>Goal reached'
            : escapeHtml(`${formatCurrency(toCurrency(fundraiser.goal - fundraiser.raised))} to go`));
    }

    //Sets the stat cards: donation match (latest donation in TV mode) and status for a campaign, campaign counts for a team event
    function updateStatCards(instant) {
        let fundraiser = JingleJam.model.fundraiser;
        //The TV page leaves out a team event's live badge
        let tvTeamEvent = JingleJam.tvPage && JingleJam.isTeamEvent();
        $('#fundraiserBadges').html(createCampaignBadges(tvTeamEvent ? { donationMatchMultiplier: fundraiser.donationMatchMultiplier } : fundraiser));

        if (JingleJam.isTeamEvent()) {
            let campaigns = JingleJam.model.campaigns;
            if (instant) {
                setCount('#embedContainer #campaignCount', campaigns.total, formatInt);
                setCount('#embedContainer #liveCampaignCount', campaigns.live, formatInt);
            }
            else {
                animateCount('#embedContainer #campaignCount', formatInt, campaigns.total);
                animateCount('#embedContainer #liveCampaignCount', formatInt, campaigns.live);
            }

            let members = JingleJam.model.teamMemberCount;
            //The TV page leaves out the matching donations count
            let matching = JingleJam.tvPage ? 0 : campaigns.items.filter(campaign => campaign.donationMatchMultiplier > 1).length;
            let activity = (members ? `<span><i class="users icon"></i>${formatInt(members)} team members</span>` : '')
                + (matching > 0 ? `<span class="activity-matching"><i class="handshake icon"></i>${formatInt(matching)} matching donations</span>` : '');
            $('#campaignActivity').html(activity).toggle(activity.length > 0);
            return;
        }

        let multiplier = fundraiser.donationMatchMultiplier || 1;
        $('#matchValue').text(multiplier > 1 ? formatInt(multiplier) + '×' : 'None').toggleClass('stat-value-muted', multiplier <= 1);

        let matches = JingleJam.model.donationMatches || [];
        let matched = matches.reduce((sum, match) => sum + match.matched, 0);
        let pledged = matches.reduce((sum, match) => sum + match.pledged, 0);
        $('#matchActivity')
            .html(matches.length > 0 ? `<span class="activity-matching">${escapeHtml(`${formatCurrency(toCurrency(matched))} of ${formatCurrency(toCurrency(pledged))} matched`)}</span>` : '')
            .toggle(matches.length > 0);

        //The newest donation, shown in TV mode in place of the donation match
        let latest = (JingleJam.model.latestDonations || [])[0];
        $('#latestDonationValue').text(latest ? formatCurrency(toCurrency(latest.amount)) : 'None').toggleClass('stat-value-muted', !latest);
        $('#latestDonationName').text(latest ? latest.name : '').toggle(!!latest);

        $('#statusValue').text(fundraiser.live ? 'Live' : 'Offline').toggleClass('stat-value-live', fundraiser.live).toggleClass('stat-value-muted', !fundraiser.live);
    }

    function updateCounts(instant = false) {
        //Get the current data
        let conversion = JingleJam.model.meta.dollarConversionRate;
        let fundraiser = JingleJam.model.fundraiser;

        //Update the components instantly
        if (instant) {
            if (!JingleJam.isWaiting()) {
                setCount('#embedContainer #mainCounter', toCurrency(fundraiser.raised), formatCurrency);
            }
        }
        //Update the components by counting up
        else {
            if (!JingleJam.isWaiting()) {
                animateCount('#embedContainer #mainCounter', formatCurrency, fundraiser.raised, fundraiser.raised * conversion);

                if(JingleJam.oldModel){
                    let amount = toCurrency(fundraiser.raised);
                    let oldAmount = JingleJam.settings.isPounds ? JingleJam.oldModel.fundraiser.raised : JingleJam.oldModel.fundraiser.raised * conversion;
                    let difference = amount - oldAmount;
                    if(difference !== 0){
                        const changeElement = document.getElementById('mainCounterChange');
                        const isPositive = difference > 0;
                        const absDifference = Math.abs(difference);

                        setCount(`#embedContainer #mainCounterChange`, absDifference, (x) => isPositive ? "+ " + formatCurrency(x) : "- " + formatCurrency(x));

                        // Set background color based on positive or negative
                        if(changeElement) {
                            if(isPositive) {
                                changeElement.style.background = 'rgba(46, 204, 113)';
                                changeElement.style.color = '#ffffff';
                            } else {
                                changeElement.style.background = 'rgba(226, 18, 18, 0.9)';
                                changeElement.style.color = '#ffffff';
                            }
                        }

                        resetAnimation();
                        setTimeout(positionChangeCounter, 50);
                    }
                }
            }
        }

        updateGoal();
        updateStatCards(instant);
        updateMatches();
        updateDonors(instant);
        updateLatestDonations();
        updateCampaigns(instant);
        updateRewards();
        updateTicker();

        $('#labelDate').text('Last Updated: ' + new Date(JingleJam.model.meta.updatedAt).toLocaleString());
    }

    //Update the model
    async function updateModel() {
        //If the model does not exist or updating is enabled
        //Also check if the next update time is less than 0 because of the browser tab check
        if (!JingleJam.model || (JingleJam.pageIsVisible && JingleJam.isLive() && getNextUpdateTime() <= 0)) {
            JingleJam.oldModel = JingleJam.model;
            try {
                JingleJam.model = await getFundraiser();
            } catch {}

            if (JingleJam.model && JingleJam.oldModel && JingleJam.isLive()) {
                updateCounts();
                setSocialLinks(JingleJam.model.social);
            }
        }
    }

    //Gets the next update time based on the model update date
    function getNextUpdateTime() {
        if(!JingleJam.model){
            return 0;
        }

        let now = new Date();
        let modelUpdateTime = JingleJam.model.meta.updatedAt ? new Date(JingleJam.model.meta.updatedAt) : new Date();

        return JingleJam.refreshTime - (now.getTime() - modelUpdateTime.getTime()) + JingleJam.waitTime;
    }

    //Run the Tiltify update loop
    async function tiltifyLoop() {

        setUpdatingLiveSpinner(true);
        try {
            await updateModel();
        } catch { }
        setUpdatingLiveSpinner(false);

        //Stop if the fundraiser does not exist
        if (JingleJam.notFound)
            return;

        //Restart the loop
        setTimeout(function () {
            tiltifyLoop();
        }, Math.max(getNextUpdateTime(), JingleJam.minRefreshTime));
    }

    //Load the causes once, for the logo of the fundraiser's cause and the number of causes
    async function loadCauses() {
        try {
            const response = await fetchWithTimeout(JingleJam.domain + '/api/v1/causes');
            if (response.ok) {
                for (let cause of (await response.json()).causes)
                    JingleJam.causes[cause.id] = cause;
            }
        } catch { }
    }

    //Get the current fundraiser data
    async function getFundraiser() {
        const response = await fetchWithTimeout(JingleJam.domain + '/api/v1/campaigns/' + encodeURIComponent(JingleJam.fundraiserId));

        if (response.status === 404) {
            JingleJam.notFound = true;
        }
        if (!response.ok) {
            throw new Error('Failed to load fundraiser (' + response.status + ')');
        }

        let data = await response.json();

        data.meta.updatedAt = new Date(data.meta.updatedAt);
        data.meta.event.startsAt = new Date(data.meta.event.startsAt);
        data.meta.event.endsAt = new Date(data.meta.event.endsAt);
        data.fundraiser = data.campaign;

        return data;
    }

    onLoad();
})();
