(function () {
    let JingleJam = {
        model: null,
        current: [],
        previous: [],
        refreshTime: 10000,         //How often to wait for an API refresh
        waitTime: 2000,             //How long to wait for the data on the backend to be updated
        minRefreshTime: 5000,       //Minimum refresh time for the API
        graphTime: 1000 * 60 * 10,  //Graph should update every 10 minutes
        pageIsVisible: true,
        startYear: 2011,
        domain: '.',
        startHour: 17,
        graphDates: {
            minDate: null,
            maxDate: null
        },
        settings: {
            isPounds: true,
        },
        timeLeft: null,
        isLive: function(){
            return !JingleJam.isWaiting() && !JingleJam.hasEnded();
        },
        isWaiting: function(){
            return new Date() <= JingleJam.model.event.start;
        },
        hasEnded: function(){
            return new Date() >= JingleJam.model.event.end;
        }
    };

    //On page setup
    async function onLoad() {
        beforeLoadSetup();

        //Start loops
        await tiltifyLoop();

        afterLoadSetup();
        hideLoader();

        await getPrevious();
        await graphLoop(true);

        //Start the timed loop
        timedLoop();
    };

    //Runs before the initial data is loaded
    function beforeLoadSetup() {
        //Get the currency stored in session
        JingleJam.settings.isPounds = localStorage.getItem('currency') !== 'false';

        //Check checkbox if the isPounds
        if (JingleJam.settings.isPounds) {
            $('#currencyCheckbox').attr('checked', 'checked')
        }

        //Set Chart Defaults
        Chart.defaults.font.family = 'Montserrat';
        Chart.defaults.font.size = 14;
        
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
        JingleJam.graphDates.minDate = Date.parse('12/01/' + JingleJam.model.event.year + ' 17:00 GMT');
        JingleJam.graphDates.maxDate = Date.parse('01/01/' + (JingleJam.model.event.year + 1) + ' 00:00 GMT');
        JingleJam.timeLeft = getTimeLeft();

        //Setup components
        setupComponents();

        //Replace HTML components with model data
        $('.jj-start-year').text(JingleJam.startYear);
        $('.jj-year').text(JingleJam.model.event.year);
        $('.jj-cause-count').text(JingleJam.model.causes.length);

        //Replace HTML tables with model data
        setTables();

        //Create the charity cards
        createCards();
        
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
        if(!JingleJam.isWaiting() || JingleJam.timeLeft.totalTime < 0){
            $('#mainCounterHeader').text('Raised In 2023');
            if($('#mainCounter').text().includes('h')){
                updateGraph();
                updateCounts(true);
            }
        }
        else {
            $('#mainCounter').html(JingleJam.timeLeft.days + "d " + JingleJam.timeLeft.hours + "h " + JingleJam.timeLeft.minutes + "m " + JingleJam.timeLeft.seconds + "s ");
            $('#mainCounterHeader').text('Countdown')
        }
    }

    //Gets the current time left until the JingleJame starts
    function getTimeLeft(){
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
    function toggleLiveRow(){
        if (!JingleJam.isLive()) {
            $('#liveUpdatingRow').parent().addClass('hide-live-update');
        }
        else{
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
                updateCards(true);
                setTables();
                createGraph();
            }
        });

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

        //Date Range Slider
        $('#dateRange').slider({
            min: 0,
            max: 744 - JingleJam.startHour,
            start: 0,
            end: 744 - JingleJam.startHour,
            step: 1,
            smooth: true,
            labelDistance: 24,
            interpretLabel: function (value) {
                let date = addHours(JingleJam.model.event.start, value);

                if (date.getHours() === 0) {
                    if (window.innerWidth < 675) {
                        if (date.getDate() % 2 === 0) {
                            return date.getDate();
                        }
                    }
                    else
                        return date.getDate();
                }
                return "";
            },
            onChange: function (e, min, max) {
                let minDate = addHours(JingleJam.model.event.start, min);
                let maxDate = addHours(JingleJam.model.event.start, max);
                updateStep(minDate.getTime(), maxDate.getTime());
            }
        });
    }

    //Add hours to a date
    function addHours(date, hours) {
        const dateCopy = new Date(date);
        dateCopy.setHours(dateCopy.getHours() + hours);
        return dateCopy;
    }

    //Add seconds to a date
    function addSeconds(date, seconds) {
        const dateCopy = new Date(date);
        dateCopy.setSeconds(dateCopy.getHours() + seconds);
        return dateCopy;
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
        let diff = (target - number);
        let startCurrency = JingleJam.settings.isPounds;

        if (number < target) {
            let interval = setInterval(function () {
                if (number >= target || index === 300 || (startCurrency !== JingleJam.settings.isPounds)) {
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
                number += incAount(++index, diff)
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
        let std = 25;
        return Math.max((1.5433 * calculateNormalDistribution(x, mean, std)) * diff, .03)
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

    //Creates the card components
    function createCards() {
        let conversion = JingleJam.model.avgConversionRate;

        let sortedCauses = JingleJam.model.causes.sort((a, b) => (a.name > b.name) ? 1 : ((b.name > a.name) ? -1 : 0))
        let causesCards = '';
        for (let cause of sortedCauses) {
            let yogDollars = cause.raised.yogscast * conversion;
            let fundDollars = cause.raised.fundraisers * conversion;

            causesCards += `
            <a class="card" style="max-width: 1100px; width: 100%; padding: 10px;" href="${cause.url}" target="_blank" id="card${cause.id}">
              <div class="image">
                <img src="${cause.logo}">
              </div>
              <div class="content">
                <div class="header">${cause.name}</div>
                <hr size="1" class="divider" style="margin: 3px 0px 8px 0px; width: calc(100% - 10px); opacity: .5; display: none;">
                <div class="description">
                    ${cause.description}
                </div>
              </div>
              <div class="total">
                <div class="extra content total-bold jj-pink">
                    <span class="raised-total">
                        ${JingleJam.settings.isPounds ? formatCurrency(cause.raised.fundraisers + cause.raised.yogscast) : formatCurrency(yogDollars + fundDollars)}
                    </span>
                    <div class="raised-label">
                        raised
                    </div>
                </div>
              </div>
            </a>`;
        }
        $('#charityCards').html(causesCards);
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

    //Set the previous years table with the previous year data
    function setTables() {
        let table = ''
        for (let year of JingleJam.model.history) {
            table += `<tr>`
            table += `<th label="Year" class="center aligned">${year.year}</th>`
            table += `<th label="Raised" class="right aligned jj-thin">${JingleJam.settings.isPounds ? formatCurrency(year.total.pounds) : formatCurrency(year.total.dollars)}</th>`
            table += '</tr>'
        }
        $('#yearsTable tbody').html(table);
    }

    function updateCounts(instant = false) {
        //Get the current data
        let conversion = JingleJam.model.avgConversionRate;
        let yogsDollars = JingleJam.model.raised.yogscast * conversion;
        let fundDollars = JingleJam.model.raised.fundraisers * conversion;

        let totalPounds = JingleJam.model.history.reduce((sum, a) => sum + a.total.pounds, 0) + JingleJam.model.raised.yogscast + JingleJam.model.raised.fundraisers;
        let totalDollars = JingleJam.model.history.reduce((sum, a) => sum + a.total.dollars, 0) + yogsDollars + fundDollars;

        let avgDollars = (yogsDollars + fundDollars) / JingleJam.model.donations.count;
        let avgPounds = (JingleJam.model.raised.yogscast + JingleJam.model.raised.fundraisers) / JingleJam.model.donations.count;

        //Update the components instantly
        if(instant){
            if (!JingleJam.isWaiting()){
                setCount('#mainCounter', (JingleJam.settings.isPounds ? (JingleJam.model.raised.yogscast + JingleJam.model.raised.fundraisers) : (yogsDollars + fundDollars)), formatCurrency);
                setCount('#bundlesSold', JingleJam.model.collections.redeemed, formatInt);
                setCount('#donationCount', JingleJam.model.donations.count, (x) => formatInt(x) + (JingleJam.isLive() ? "+" : ""));
                setCount('#averageDonation', (JingleJam.settings.isPounds ? avgPounds : avgDollars), (x) => formatCurrency(x, 2));
            }
            else {
                setCount('#bundlesSold', 0, formatInt);
                setCount('#donationCount', 0, (x) => formatInt(x) + (JingleJam.isLive() ? "+" : ""));
                setCount('#averageDonation', 0, (x) => formatCurrency(x, 2));
            }

            setCount('#raisedEntire', (JingleJam.settings.isPounds ? totalPounds : totalDollars), formatCurrency);
        }
        //Update the components by counting up
        else{
            if (!JingleJam.isWaiting()){
                animateCount('#mainCounter', formatCurrency, (JingleJam.model.raised.yogscast + JingleJam.model.raised.fundraisers), (yogsDollars + fundDollars));
                animateCount('#bundlesSold', formatInt, JingleJam.model.collections.redeemed);
                animateCount('#donationCount', (x) => formatInt(x) + (JingleJam.isLive() ? "+" : ""), JingleJam.model.donations.count);
                animateCount('#averageDonation', (x) => formatCurrency(x, 2), avgPounds, avgDollars);
            }
            else {
                animateCount('#bundlesSold', formatInt, 0);
                animateCount('#donationCount', (x) => formatInt(x) + (JingleJam.isLive() ? "+" : ""), 0);
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
            JingleJam.model = await getTiltify();

            JingleJam.model.history.reverse();
            
            if (JingleJam.isLive())
                await updateCounts();
        }
    }

    //Update the graph
    async function updateGraph() {
        if (JingleJam.pageIsVisible) {
            await getCurrent();
            await createGraph();
        }
    }

    //Gets the next update time based on the model update date
    function getNextUpdateTime() {
        let now = new Date();
        let modelUpdateTime = JingleJam.model.date ? new Date(JingleJam.model.date) : new Date();

        return JingleJam.refreshTime - (now.getTime() - modelUpdateTime.getTime()) + JingleJam.waitTime;
    }

    //Run the graph update loop
    async function graphLoop(force = false) {
        //Restart the loop
        setTimeout(function () {
            graphLoop();
        }, JingleJam.graphTime);

        //If the Jingle Jam is not live, ignore the update
        if (!JingleJam.isLive() && !force)
            return;

        setUpdatingLiveSpinner(true);
        await updateGraph();
        setUpdatingLiveSpinner(false);
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

    function groupBy(list, keyGetter) {
        const map = new Map();
        list.forEach((item) => {
            const key = keyGetter(item);
            const collection = map.get(key);
            if (!collection) {
                map.set(key, [item]);
            } else {
                collection.push(item);
            }
        });
        return map;
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

    //Get the current year graph data
    async function getCurrent() {
        try {
            let response = await fetchWithTimeout(JingleJam.domain + '/api/current');

            let points = await response.json();

            for (let point of points) {
                point.time = new Date(Date.parse(point.timestamp + ' GMT ' + JingleJam.model.event.year));
                point.x = point.time.getTime();
            }

            JingleJam.current = groupBy(points, x => x.year);
        }
        catch {
            JingleJam.current = [];
        }
    }

    //Get the previous year graph data
    async function getPrevious() {
        let points = await (await fetchWithTimeout(JingleJam.domain + '/api/previous')).json();

        for (let point of points) {
            point.time = new Date(point.timestamp + " GMT");

            if (point.time.getMonth() < 10)
                point.x = point.time.setFullYear(JingleJam.model.event.year + 1);
            else
                point.x = point.time.setFullYear(JingleJam.model.event.year);
        }

        JingleJam.previous = groupBy(points, x => x.year);
    }

    function getClientTimezone() {
        return new Intl.DateTimeFormat('en', {
            timeZoneName: 'short',
        }).formatToParts(new Date()).find(part => part.type === 'timeZoneName').value;
    }

    const colors = {
        '2016': '#46bdc6',
        '2017': '#ab30c4',
        '2018': '#c1bc1f',
        '2019': '#71f437',
        '2020': '#ff0081',
        '2021': '#6967ff',
        '2022': '#6ba950',
        '2023': '#d64538'
    }
    let myChart;

    async function createGraph() {
        let data = {
            type: 'line',
            labels: new Set(),
            datasets: []
        }

        for (let year of JingleJam.previous) {
            if (year[0] < 2016)
                continue;

            year[1].forEach(x => data.labels.add(x.x));
            data.datasets.push({
                label: year[0],
                showLine: true,
                fill: false,
                borderColor: colors[year[0]] + 'BB',
                backgroundColor: colors[year[0]] + 'BB',
                borderWidth: 3,
                pointRadius: 0,
                pointHoverRadius: 3,
                order: 2,
                borderDash: [2],
                data: year[1].filter(x => x.time.getMonth() >= 11).map(function (m) { return { x: m.x, y: m[JingleJam.settings.isPounds ? 'amountPounds' : 'amountDollars'] }; })
            })
        }

        for (let year of JingleJam.current) {
            year[1].forEach(x => data.labels.add(x.x));
            data.datasets.push({
                label: year[0],
                showLine: true,
                fill: false,
                borderColor: colors[year[0]],
                backgroundColor: colors[year[0]],
                borderWidth: 4,
                pointRadius: 0,
                pointHoverRadius: 3,
                order: 1,
                data: year[1].map(function (m) { return { x: m.x, y: m[JingleJam.settings.isPounds ? 'amountPounds' : 'amountDollars'] }; })
            })
        }

        if (myChart) {
            myChart.data = data;
            myChart.update('none');
            return;
        }

        let ctxR = $('#comparisonChart')
        myChart = new Chart(ctxR, {
            type: 'scatter',
            data: data,
            options: {
                elements: {
                    line: {
                        tension: .5
                    }
                },
                responsive: true,
                maintainAspectRatio: false,
                hover: {
                    mode: 'nearest',
                    intersect: true
                },
                scales: {
                    x: {
                        type: 'time',
                        time: {
                            displayFormats: {
                                'millisecond': 'D - H:mm',
                                'second': 'D - H:mm',
                                'minute': 'D - H:mm',
                                'hour': 'D - H:00',
                                'day': 'D',
                                'week': 'D',
                                'month': 'D',
                                'quarter': 'D',
                                'year': 'D',
                            }
                        },
                        title: {
                            display: true,
                            text: `Day (${getClientTimezone()})`
                        },
                        min: JingleJam.graphDates.minDate,
                        max: JingleJam.graphDates.maxDate,
                        grid: {
                            color: '#d4d4d4'
                        }
                    },
                    y: {
                        type: 'linear',
                        title: {
                            display: false,
                            text: 'Amount Raised'
                        },
                        ticks: {
                            // Include a dollar sign in the ticks
                            callback: function (value, index, ticks) {
                                let tickDiff = ticks[1].value - ticks[0].value;
                                if (value < 1000000)
                                    return formatCurrency(value / 1000, 0, false) + 'k'
                                else if (tickDiff < 10000)
                                    return formatCurrency(value / 1000000, 3, false) + 'm'
                                else if (tickDiff < 100000)
                                    return formatCurrency(value / 1000000, 2, false) + 'm'

                                return formatCurrency(value / 1000000, 1, false) + 'm'
                            }
                        },
                        grid: {
                            color: '#d4d4d4'
                        }
                    }
                },
                plugins: {
                    title: {
                        display: false,
                        text: 'Amount Raised Over Time'
                    },
                    tooltip: {
                        callbacks: {
                            label: function (tooltipItem, data) {
                                return ' ' + tooltipItem.dataset.label + ' - ' + formatCurrency(tooltipItem.raw.y, 0, false) + ' (' + tooltipItem.label + ')';
                            }
                        }
                    }
                },
            }
        });
        myChart.update();
    }

    function updateStep(min, max) {
        min = parseInt(min);
        max = parseInt(max);

        JingleJam.graphDates.minDate = new Date(min);
        JingleJam.graphDates.maxDate = new Date(max);

        myChart.options.scales.x.min = min
        myChart.options.scales.x.max = max
        myChart.update();
    }

    onLoad();
})();