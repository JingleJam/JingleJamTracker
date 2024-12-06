(function () {
    let JingleJam = {
        model: null,
        oldModel: null,
        current: [],
        previous: [],
        refreshTime: 10000,         //How often to wait for an API refresh
        waitTime: 4000,             //How long to wait for the data on the backend to be updated
        minRefreshTime: 5000,       //Minimum refresh time for the API
        graphTime: 1000 * 60 * 10,  //Graph should update every 10 minutes
        pageIsVisible: true,
        startYear: 2011,
        domain: '.',
        graphDates: {
            minDate: null,
            maxDate: null
        },
        settings: {
            isPounds: true,
        },
        timeLeft: null,
        isLive: function () {
            return !JingleJam.isWaiting() && !JingleJam.hasEnded();
        },
        isWaiting: function () {
            return new Date() <= JingleJam.model.event.start;
        },
        hasEnded: function () {
            return new Date() >= JingleJam.model.event.end;
        }
    };

    //On page setup
    async function onLoad() {
        beforeLoadSetup();

        //Start loops
        await tiltifyLoop();

        if(JingleJam.model){
            afterLoadSetup();

            hideLoader();
    
            //Start the timed loop
            timedLoop();
        }
        else {
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

        //Enable the updating live spinner
        setUpdatingLiveSpinner(true);
    }

    //Runs after the initial data is loaded
    function afterLoadSetup() {

        //Set some compouted data
        JingleJam.graphDates.minDate = JingleJam.model.event.start;//Date.parse('12/01/' + JingleJam.model.event.year + ' 17:00 GMT');
        JingleJam.graphDates.maxDate = Date.parse('01/01/' + (JingleJam.model.event.year + 1) + ' 00:00 GMT');
        JingleJam.timeLeft = getTimeLeft();

        //Setup components
        setupComponents();

        //Replace HTML components with model data
        $('.jj-start-year').text(JingleJam.startYear);
        $('.jj-year').text(JingleJam.model.event.year);
        $('.jj-cause-count').text(JingleJam.model.causes.length);

        //Set the data on load
        updateCounts();
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
            $('#mainCounterHeader').text('Raised For ' + JingleJam.model.event.year);
            if ($('#mainCounter').text().includes('h')) {
                updateCounts(true);
            }
        }
        else {
            $('[data-status]').attr('data-status', 'countdown')
            $('#mainCounter').html(JingleJam.timeLeft.days + "d " + JingleJam.timeLeft.hours + "h " + JingleJam.timeLeft.minutes + "m " + JingleJam.timeLeft.seconds + "s ");
            $('#mainCounterHeader').text('Countdown to ' + JingleJam.model.event.year);
        }
    }

    //Gets the current time left until the JingleJame starts
    function getTimeLeft() {
        var now = new Date().getTime();
        var totalTime = JingleJam.model.event.start - now;

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
        $('#content').show();
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
                    if (!JingleJam.model.date || (new Date() - new Date(JingleJam.model.date)) > (JingleJam.refreshTime + JingleJam.waitTime)) {
                        updateModel();
                    }
                }, 1000);
            }, false);
        }
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

    //Update the totals on the charities cards
    function updateCards(instant = false) {
        let conversion = JingleJam.model.avgConversionRate;

        let sortedCauses = JingleJam.model.causes.sort((a, b) => (a.name > b.name) ? 1 : ((b.name > a.name) ? -1 : 0));
        for (let cause of sortedCauses) {
            let yogDollars = cause.raised.yogscast * conversion;
            let fundDollars = cause.raised.fundraisers * conversion;

            let totalFund = (cause.raised.fundraisers + cause.raised.yogscast);
            let totalFundDollar = (yogDollars + fundDollars);

            if (JingleJam.isWaiting())
                setCount(`#charityCards #card${cause.id} .raised-total`, 0, formatCurrency);
            else if (instant)
                setCount(`#charityCards #card${cause.id} .raised-total`, (JingleJam.settings.isPounds ? totalFund : totalFundDollar), formatCurrency);
            else
                animateCount(`#charityCards #card${cause.id} .raised-total`, formatCurrency, totalFund, totalFundDollar);
        }
    }

    function updateCounts(instant = false) {
        //Get the current data
        let conversion = JingleJam.model.avgConversionRate;
        let yogsDollars = JingleJam.model.raised.yogscast * conversion;
        let fundDollars = JingleJam.model.raised.fundraisers * conversion;

        let totalPounds = JingleJam.model.history.reduce((sum, a) => sum + a.total.pounds, 0) + JingleJam.model.raised.yogscast + JingleJam.model.raised.fundraisers;
        let totalDollars = JingleJam.model.history.reduce((sum, a) => sum + a.total.dollars, 0) + yogsDollars + fundDollars;

        let avgDollars = !JingleJam.model.donations.count ? 0 : (yogsDollars + fundDollars) / JingleJam.model.donations.count;
        let avgPounds = !JingleJam.model.donations.count ? 0 : (JingleJam.model.raised.yogscast + JingleJam.model.raised.fundraisers) / JingleJam.model.donations.count;

        //Update the components instantly
        if (instant) {
            if (!JingleJam.isWaiting()) {
                setCount('#mainCounter', (JingleJam.settings.isPounds ? (JingleJam.model.raised.yogscast + JingleJam.model.raised.fundraisers) : (yogsDollars + fundDollars)), formatCurrency);
                setCount('#bundlesSold', JingleJam.model.collections.redeemed, formatInt);
                setCount('#donationCount', JingleJam.model.donations.count, (x) => formatInt(x));
                setCount('#averageDonation', (JingleJam.settings.isPounds ? avgPounds : avgDollars), (x) => formatCurrency(x, 2));
            }
            else {
                setCount('#bundlesSold', 0, formatInt);
                setCount('#donationCount', 0, (x) => formatInt(x));
                setCount('#averageDonation', 0, (x) => formatCurrency(x, 2));
            }

            setCount('#raisedEntire', (JingleJam.settings.isPounds ? totalPounds : totalDollars), formatCurrency);
        }
        //Update the components by counting up
        else {
            if (!JingleJam.isWaiting()) {
                animateCount('#mainCounter', formatCurrency, JingleJam.model.raised.yogscast + JingleJam.model.raised.fundraisers, yogsDollars + fundDollars);
                animateCount('#bundlesSold', formatInt, JingleJam.model.collections.redeemed);
                animateCount('#donationCount', (x) => formatInt(x), JingleJam.model.donations.count);
                animateCount('#averageDonation', (x) => formatCurrency(x, 2), avgPounds, avgDollars);

                if(JingleJam.oldModel){
                    let oldYogsDollars = JingleJam.oldModel.raised.yogscast * conversion;
                    let oldFundDollars = JingleJam.oldModel.raised.fundraisers * conversion;

                    let amount = (JingleJam.settings.isPounds ? (JingleJam.model.raised.yogscast + JingleJam.model.raised.fundraisers) : (yogsDollars + fundDollars));
                    let oldAmount = (JingleJam.settings.isPounds ? (JingleJam.oldModel.raised.yogscast + JingleJam.oldModel.raised.fundraisers) : (oldYogsDollars + oldFundDollars));
                    let difference = amount - oldAmount;
                    if(difference > 0){
                        setCount(`#mainCounterChange`, amount - oldAmount, (x) => "+ " + formatCurrency(x));
                        
                        resetAnimation();
                    }
                }
            }
            else {
                animateCount('#bundlesSold', formatInt, 0);
                animateCount('#donationCount', (x) => formatInt(x), 0);
                animateCount('#averageDonation', (x) => formatCurrency(x, 2), 0, 0);
            }

            animateCount('#raisedEntire', formatCurrency, totalPounds, totalDollars);
        }

        updateCards(instant);

        $('#labelDate').text('Last Updated: ' + new Date(JingleJam.model.date).toLocaleString());
    }

    //Update the model
    async function updateModel() {
        //If the model does not exist or updating is enabled
        //Also check if the next update time is less than 0 because of the browser tab check
        if (!JingleJam.model || (JingleJam.pageIsVisible && JingleJam.isLive() && getNextUpdateTime() <= 0)) {
            JingleJam.oldModel = JingleJam.model;
            try {
                JingleJam.model = await getTiltify();
            } catch {}

            if(JingleJam.model){
                JingleJam.model.history.reverse();

                if (JingleJam.isLive()){
                    await updateCounts();
                }   
            }
        }
    }

    //Gets the next update time based on the model update date
    function getNextUpdateTime() {
        if(!JingleJam.model){
            return 0;
        }

        let now = new Date();
        let modelUpdateTime = JingleJam.model.date ? new Date(JingleJam.model.date) : new Date();

        return JingleJam.refreshTime - (now.getTime() - modelUpdateTime.getTime()) + JingleJam.waitTime;
    }

    //Run the Tiltify update loop
    async function tiltifyLoop() {

        setUpdatingLiveSpinner(true);
        try {
            await updateModel();
        } catch { }
        setUpdatingLiveSpinner(false);

        //Restart the loop
        setTimeout(function () {
            tiltifyLoop();
        }, Math.max(getNextUpdateTime(), JingleJam.minRefreshTime));
    }

    //Get the current model data
    async function getTiltify() {
        const response = await fetchWithTimeout(JingleJam.domain + '/api/tiltify');

        let data = await response.json();

        data.date = new Date(data.date);
        data.event.start = new Date(data.event.start);
        data.event.end = new Date(data.event.end);

        return data;
    }

    onLoad();
})();