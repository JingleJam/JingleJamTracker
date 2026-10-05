(function () {
    let JingleJam = {
        model: null,
        oldModel: null,
        causeSlug: null,
        notFound: false,
        campaignLimit: 25,          //Number of top campaigns to show
        refreshTime: 10000,         //How often to wait for an API refresh
        waitTime: 5000,             //How long to wait for the data on the backend to be updated
        minRefreshTime: 5000,       //Minimum refresh time for the API
        pageIsVisible: true,
        tvPage: false,              //Whether this is the /tv page, which is always in TV mode
        tvControlsTimeout: null,
        tvTickerSpeed: 16,          //Seconds for the TV ticker to scroll one screen width
        domain: '',                 //Root-relative, since the page is served at /causes/<cause>
        settings: {
            isPounds: true,
        },
        timeLeft: null,
        isEvent: function () {
            return JingleJam.causeSlug === EVENT.slug;
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

    //The whole event (every cause) is shown at /jingle-jam, in the same layout as a cause
    const EVENT = {
        slug: 'jingle-jam',
        name: 'Jingle Jam',
        color: '#e21251',
        url: 'https://www.jinglejam.co.uk',
        logoPath: '/assets/jingle-jam-2026-logo.webp',
    };

    //On page setup
    async function onLoad() {
        beforeLoadSetup();

        //Start loops
        if (JingleJam.causeSlug) {
            await tiltifyLoop();
        }

        if (JingleJam.model) {
            afterLoadSetup();
            hideLoader();

            //Start the timed loop
            timedLoop();
        }
        else {
            if (!JingleJam.causeSlug || JingleJam.notFound) {
                $('#embedContainer #errorMessage').text('Cause Not Found');
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

        //Cause lookup, from the embed container or the /causes/<cause> (or /jingle-jam) URL
        JingleJam.causeSlug = getCauseSlug();

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
        setCauseDetails();

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

    //Gets the cause slug to load
    function getCauseSlug() {
        let attr = $('#embedContainer').attr('data-cause');
        if (attr)
            return attr;

        //The whole event is at /jingle-jam, each cause at /causes/<cause>
        if (/^\/jingle-jam\/?$/i.test(window.location.pathname))
            return EVENT.slug;

        let match = window.location.pathname.match(/^\/causes\/([^/]+)\/?$/i);
        if (!match)
            return null;

        try {
            return decodeURIComponent(match[1]);
        } catch {
            return null;
        }
    }

    //The /tv page for this cause (or the whole event)
    function getTvUrl() {
        return JingleJam.domain + '/tv?type=cause&id=' + encodeURIComponent(JingleJam.model.cause.slug || JingleJam.causeSlug);
    }

    //Loop to update data on the page as needed
    function timedLoop() {
        var x = setInterval(function () {
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
            $('#mainCounterHeader').html('<i class="money icon"></i>Raised For ' + escapeHtml(JingleJam.model.cause.name));
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

    //Creates or updates the scrolling TV ticker of top campaigns
    function updateTicker(force = false) {
        if (!isTvMode())
            return;

        let campaigns = JingleJam.model.campaigns.items;
        let track = $('#tvTickerTrack');

        $('#tvTickerEmpty').toggle(campaigns.length === 0);

        //Rebuild when the campaigns or their order changed (or the screen size changed), otherwise update the values in place
        let ids = campaigns.map(x => x.id).join(',');
        if (force || track.attr('data-ids') !== ids) {
            track.attr('data-ids', ids);

            let set = campaigns.map((campaign, index) => createTickerItem(campaign, index)).join('');
            track.html(set);

            //Repeat the campaigns enough times to always fill the screen, then scroll by exactly one set so it loops seamlessly
            let setWidth = track[0].scrollWidth;
            let windowWidth = track.parent().width();
            if (setWidth > 0) {
                let copies = Math.max(2, Math.ceil(windowWidth / setWidth) + 1);
                track.html(set.repeat(copies));

                track[0].style.setProperty('--ticker-distance', `-${setWidth}px`);
                track[0].style.setProperty('--ticker-duration', `${(setWidth / windowWidth) * JingleJam.tvTickerSpeed}s`);
            }
        }

        campaigns.forEach((campaign, index) => {
            let items = track.find(`.tv-campaign[data-index="${index}"]`);
            items.find('.tv-campaign-total').text(formatCurrency(toCurrency(campaign.raised)));
            //LIVE sits next to the user name, the donation match badge next to the amount
            items.find('.tv-campaign-live').html(createCampaignBadges({ live: campaign.live }));
            items.find('.tv-campaign-badges').html(createCampaignBadges({ donationMatchMultiplier: campaign.donationMatchMultiplier }));

            //Goal pill: the fill shows progress towards the goal, and turns green once it's reached
            if (campaign.goal > 0) {
                let goalMet = campaign.raised >= campaign.goal;
                let percentage = Math.floor((campaign.raised / campaign.goal) * 100);
                items.find('.tv-campaign-goal')
                    .toggleClass('goal-met', goalMet)
                    .css('--goal-progress', Math.min(percentage, 100) + '%')
                    .html(`${goalMet ? '<i class="check circle icon"></i>' : ''}<span>${percentage}% of ${formatCurrency(toCurrency(campaign.goal), 0, false)}</span>`);
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
                  <span class="tv-campaign-badges"></span>
                  ${campaign.goal > 0 ? '<span class="tv-campaign-goal"></span>' : ''}
                </div>
              </div>
            </div>`;
    }

    //Sets the cause name, logo, links and colours
    function setCauseDetails() {
        let cause = JingleJam.model.cause;

        //The event-level page (every cause) uses the same layout, with a few cause-specific parts swapped out
        let isEvent = JingleJam.isEvent();
        $('#embedContainer').toggleClass('event-scope', isEvent);
        document.title = isEvent ? 'Jingle Jam Tracker' : cause.name + ' - Jingle Jam Tracker';

        //The page can be embedded on other sites, so load the logo from the tracker's domain
        $('#jjLogo').attr('src', JingleJam.domain + '/assets/jingle-jam-2026-logo.webp');
        $('#jjLogoLink').attr('href', JingleJam.domain + '/home');
        $('#homeButton').attr('href', JingleJam.domain + '/home');
        setupSearchButton();

        $('.jj-year').text(JingleJam.model.meta.event.year);
        $('.jj-cause-name').text(cause.name);

        $('#causeName').text(cause.name);
        $('#causeDescription').text(cause.description);
        //The bordered logo is shown by default, and the bare logo in TV mode (CSS picks which one is visible)
        $('#causeLogo').attr('src', safeUrl(cause.borderedLogo || cause.logo)).attr('alt', cause.name);
        $('#causeTvLogo').attr('src', safeUrl(cause.logo)).attr('alt', cause.name);
        $('#causeDonateLink').attr('href', safeUrl(cause.donateUrl));
        $('#causeWebsiteLink').attr('href', safeUrl(cause.url));

        setCauseColors(cause.color);
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

    //Creates or updates the top campaigns list
    function updateCampaigns(instant = false) {
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

    function updateCounts(instant = false) {
        //Get the current data
        let conversion = JingleJam.model.meta.dollarConversionRate;
        let cause = JingleJam.model.cause;
        //Live campaigns for the cause (or whole event), falling back to the campaign totals for older cached data
        let liveCount = cause.live ?? JingleJam.model.campaigns.live ?? 0;

        //Update the components instantly
        if (instant) {
            if (!JingleJam.isWaiting()) {
                setCount('#embedContainer #mainCounter', toCurrency(cause.raised), formatCurrency);
            }
            setCount('#embedContainer #campaignCount', JingleJam.model.campaigns.total, formatInt);
            setCount('#embedContainer #liveCampaignCount', liveCount, formatInt);
        }
        //Update the components by counting up
        else {
            if (!JingleJam.isWaiting()) {
                animateCount('#embedContainer #mainCounter', formatCurrency, cause.raised, cause.raised * conversion);

                if(JingleJam.oldModel){
                    let amount = toCurrency(cause.raised);
                    let oldAmount = JingleJam.settings.isPounds ? JingleJam.oldModel.cause.raised : JingleJam.oldModel.cause.raised * conversion;
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
            animateCount('#embedContainer #campaignCount', formatInt, JingleJam.model.campaigns.total);
            animateCount('#embedContainer #liveCampaignCount', formatInt, liveCount);
        }

        updateCampaigns(instant);
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
                JingleJam.model = await getCause();
            } catch {}

            if (JingleJam.model && JingleJam.oldModel && JingleJam.isLive()) {
                await updateCounts();
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

        //Stop if the cause does not exist
        if (JingleJam.notFound)
            return;

        //Restart the loop
        setTimeout(function () {
            tiltifyLoop();
        }, Math.max(getNextUpdateTime(), JingleJam.minRefreshTime));
    }

    //Get the current cause data, or the whole event's (which includes its top 25 campaigns)
    async function getCause() {
        const response = await fetchWithTimeout(JingleJam.isEvent()
            ? JingleJam.domain + '/api/v1/event'
            : JingleJam.domain + '/api/v1/causes/' + encodeURIComponent(JingleJam.causeSlug) + '?limit=' + JingleJam.campaignLimit);

        if (response.status === 404) {
            JingleJam.notFound = true;
        }
        if (!response.ok) {
            throw new Error('Failed to load cause (' + response.status + ')');
        }

        let data = await response.json();

        data.meta.updatedAt = new Date(data.meta.updatedAt);
        data.meta.event.startsAt = new Date(data.meta.event.startsAt);
        data.meta.event.endsAt = new Date(data.meta.event.endsAt);

        if (JingleJam.isEvent())
            data.cause = getEventCause(data);

        return data;
    }

    //Describes the whole event as a cause, so it can use the same layout
    function getEventCause(data) {
        let names = data.causes.map(cause => cause.name);
        let causeList = names.length > 1 ? names.slice(0, -1).join(', ') + ' and ' + names[names.length - 1] : names.join('');

        //Every cause's donate link points at the same Tiltify fundraiser, so use its home page
        let donateUrl = EVENT.url;
        try {
            if (data.causes[0] && data.causes[0].donateUrl)
                donateUrl = new URL(data.causes[0].donateUrl).origin;
        } catch { }

        //Absolute, since the page only shows http(s) image URLs
        let logo = (JingleJam.domain || window.location.origin) + EVENT.logoPath;

        return {
            slug: EVENT.slug,
            name: EVENT.name,
            logo: logo,
            borderedLogo: logo,
            description: `Raising money for ${names.length} causes: ${causeList}.`,
            color: EVENT.color,
            url: EVENT.url,
            donateUrl: donateUrl,
            raised: data.raised,
            campaigns: data.campaigns.total,
            live: data.campaigns.live,
        };
    }

    onLoad();
})();
