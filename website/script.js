(function () {
    let JingleJam = {
        model: {},
        previous: [],
        graph: [],
        refreshTime: 10000, //How often to wait to refresh
        waitTime: 1500,     //How long to wait for the data on the backend to be updated
        minRefreshTime: 5000,
        graphTime: 1000 * 60 * 10,
        update: true,
        startYear: 2011,
        domain: '.',
        isFinished: false,
        startHour: 17,
        startDate: null,
        graphDates: {
            minDate: null,
            maxDate: null
        }
    };

    if (window.location.hostname.includes('jinglejam.co.uk') ||
        window.location.hostname.includes('squarespace.com') ||
        window.location.hostname.includes('yogscast.com'))
        JingleJam.domain = 'https://dashboard.jinglejam.co.uk';

    let isPounds = localStorage.getItem('currency') !== 'false';

    async function onLoad() {
        if (isPounds) {
            $('#currencyCheckbox').attr('checked', 'checked')
        }

        if (JingleJam.isFinished) {
            $('#liveUpdatingRow').parent().addClass('hide-live-update');
        }

        Chart.defaults.font.family = 'Montserrat';
        Chart.defaults.font.size = 14;

        toggleLiveUpdateSpinner(true);

        await Promise.all([
            realTimeLoop(),
            getPrevious()
        ]);

        JingleJam.startDate = new Date('Dec 01 ' + JingleJam.model.year + ' ' + JingleJam.startHour + ':00:00');
        JingleJam.graphDates.minDate = Date.parse('12/01/' + JingleJam.model.year + ' 17:00');
        JingleJam.graphDates.maxDate = Date.parse('01/01/' + (JingleJam.year + 1) + ' 00:00');
        createEvents();

        await graphLoop();

        setStaticContent();

        finishedLoading();
    };

    function setStaticContent() {
        $('.jj-start-year').text(JingleJam.startYear);
        $('.jj-year').text(JingleJam.model.year);
        $('.jj-cause-count').text(JingleJam.model.causes.length);
        setTables();
    }

    function finishedLoading() {
        $('#loader').hide();
        $('#content').show();
    }

    function toggleLiveUpdateSpinner(bool) {
        if (bool) {
            $('#liveUpdatingRow .loader').show();
            $('#liveUpdatingRow .loading-circle').hide();
        }
        else {
            $('#liveUpdatingRow .loader').hide();
            $('#liveUpdatingRow .loading-circle').show();
        }
    }

    async function fetchWithTimeout(resource, timeout = 5000) {
        const controller = new AbortController();
        const fetchId = setTimeout(() => controller.abort(), timeout);
        const response = await fetch(resource, {
            signal: controller.signal
        });
        clearTimeout(fetchId);
        return response;
    }

    function createEvents() {
        $('#currencyCheckbox').checkbox({
            onChange: function () {
                isPounds = $('#currencyCheckbox').is(':checked');
                localStorage.setItem('currency', isPounds);

                setAmounts();
                updateCards(true);
                setTables();
                createGraph();
            }
        });

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
                JingleJam.update = !document[hidden];

                if (JingleJam.isFinished)
                    return;

                //If tab is back in focus and the screen did not refresh, refresh it after 1 second
                setTimeout(function () {
                    if (!JingleJam.model.date || (new Date() - new Date(JingleJam.model.date)) > (JingleJam.refreshTime + JingleJam.waitTime)) {
                        updateScreen();
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
                let date = addHours(JingleJam.startDate, value);

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
                let minDate = addHours(JingleJam.startDate, min);
                let maxDate = addHours(JingleJam.startDate, max);
                updateStep(minDate.getTime(), maxDate.getTime());
            }
        });
    }

    function addHours(date, hours) {
        const dateCopy = new Date(date);
        dateCopy.setHours(dateCopy.getHours() + hours);
        return dateCopy;
    }


    async function getTiltify() {
        const response = await fetchWithTimeout(JingleJam.domain + '/api/tiltify');

        return await response.json();
    }

    function formatCurrency(total, decimals = 0, includeSpace = true) {
        let neg = false;
        if (total < 0) {
            neg = true;
            total = Math.abs(total);
        }

        let currency = isPounds ? '£' : '$';

        let amount = 0
        if (decimals > 0)
            amount = parseFloat(total).toFixed(decimals).replace(/(\d)(?=(\d{3})+\.)/g, "$1,").toString();
        else
            amount = parseInt(total).toLocaleString("en-US");

        return (neg ? ("-" + currency) : currency) + (includeSpace ? " " : "") + amount;
    }

    function formatInt(x) {
        return parseInt(x).toLocaleString();
    }

    //Secondary = dollars
    function animateCount(elem, format, targetPrimary, targetSecondary = null) {
        let number = parseFloat($(elem).data('value'));
        let target = targetSecondary === null ? targetPrimary : (isPounds ? targetPrimary : targetSecondary)

        if (isNaN(number))
            number = 0;

        if (!target)
            target = 0;

        let index = 80;
        let diff = (target - number);
        let startCurrency = isPounds;

        if (number < target) {
            let interval = setInterval(function () {
                if (number >= target || index === 300 || (startCurrency !== isPounds)) {
                    if((startCurrency !== isPounds) && targetSecondary !== null){
                        target = isPounds ? targetPrimary : targetSecondary;
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

    function formatNumberText(ele, val){
        let spans = '';
        for(let digit of val.toString().split('')){
            let isComma = digit === ',' || digit === '.' || digit === '$' || digit === '£';
            spans += isComma ? `<span class="comma-value">${digit}</span>` : digit;
        }
        $(ele).html(spans);
    }

    function incAount(x, diff){
        let mean = 100;
        let std = 40;
        return Math.max((1.4558*calculateNormalDistribution(x, mean, std)) * diff, .03)
    }

    function calculateNormalDistribution(x, mean, stdDev) {
        const variance = stdDev ** 2;
        const numerator = Math.exp(-((x - mean) ** 2) / (2 * variance));
        const denominator = Math.sqrt(2 * Math.PI * variance);
        return numerator / denominator;
    }

    function setCount(elem, target, format) {
        $(elem).data('value', target);
        formatNumberText(elem, format(target))
    }

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
                        ${isPounds ? formatCurrency(cause.raised.fundraisers + cause.raised.yogscast) : formatCurrency(yogDollars + fundDollars)}
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

    function updateCards(instant = false) {
        let conversion = JingleJam.model.avgConversionRate;

        let sortedCauses = JingleJam.model.causes.sort((a, b) => (a.name > b.name) ? 1 : ((b.name > a.name) ? -1 : 0));
        for (let cause of sortedCauses) {
            let yogDollars = cause.raised.yogscast * conversion;
            let fundDollars = cause.raised.fundraisers * conversion;

            if(instant)
                setCount(`#charityCards #card${cause.id} .raised-total`, (isPounds ? (cause.raised.fundraisers + cause.raised.yogscast) : (yogDollars + fundDollars)), formatCurrency);
            else 
                animateCount(`#charityCards #card${cause.id} .raised-total`, formatCurrency, (cause.raised.fundraisers + cause.raised.yogscast), (yogDollars + fundDollars));
        }
    }

    function setTables() {
        let table = ''
        for (let year of JingleJam.model.history) {
            table += `<tr>`
            table += `<th label="Year" class="center aligned">${year.year}</th>`
            table += `<th label="Final Total" class="right aligned jj-thin">${isPounds ? formatCurrency(year.total.pounds) : formatCurrency(year.total.dollars)}</th>`
            table += '</tr>'
        }
        $('#yearsTable tbody').html(table);
    }

    let firstUpdate = true;

    function onUpdate() {
        let conversion = JingleJam.model.avgConversionRate;
        let yogsDollars = JingleJam.model.raised.yogscast * conversion;
        let fundDollars = JingleJam.model.raised.fundraisers * conversion;

        let totalPounds = JingleJam.model.history.reduce((sum, a) => sum + a.total.pounds, 0) + JingleJam.model.raised.yogscast + JingleJam.model.raised.fundraisers;
        let totalDollars = JingleJam.model.history.reduce((sum, a) => sum + a.total.dollars, 0) + yogsDollars + fundDollars;

        let avgDollars = (yogsDollars + fundDollars) / JingleJam.model.donations.count;
        let avgPounds = (JingleJam.model.raised.yogscast + JingleJam.model.raised.fundraisers) / JingleJam.model.donations.count;

        animateCount('#raisedTotal', formatCurrency, (JingleJam.model.raised.yogscast + JingleJam.model.raised.fundraisers), (yogsDollars + fundDollars));
        animateCount('#raisedEntire', formatCurrency, totalPounds, totalDollars);
        animateCount('#bundlesSold', formatInt, JingleJam.model.collections.redeemed);
        animateCount('#donationCount', (x) => formatInt(x) + (!JingleJam.isFinished ? "+" : ""), JingleJam.model.donations.count);
        animateCount('#averageDonation', (x) => formatCurrency(x, 2), avgPounds, avgDollars);

        if (firstUpdate) {
            createCards();
            firstUpdate = false;
        }

        updateCards();

        $('#labelDate').text('Last Updated: ' + new Date(JingleJam.model.date).toLocaleString());
    }
    
    function setAmounts() {
        let conversion = JingleJam.model.avgConversionRate;
        let yogsDollars = JingleJam.model.raised.yogscast * conversion;
        let fundDollars = JingleJam.model.raised.fundraisers * conversion;

        let totalPounds = JingleJam.model.history.reduce((sum, a) => sum + a.total.pounds, 0) + JingleJam.model.raised.yogscast + JingleJam.model.raised.fundraisers;
        let totalDollars = JingleJam.model.history.reduce((sum, a) => sum + a.total.dollars, 0) + yogsDollars + fundDollars;

        let avgDollars = (yogsDollars + fundDollars) / JingleJam.model.donations.count;
        let avgPounds = (JingleJam.model.raised.yogscast + JingleJam.model.raised.fundraisers) / JingleJam.model.donations.count;

        setCount('#raisedTotal', (isPounds ? (JingleJam.model.raised.yogscast + JingleJam.model.raised.fundraisers) : (yogsDollars + fundDollars)), formatCurrency);
        setCount('#raisedEntire', (isPounds ? totalPounds : totalDollars), formatCurrency);
        setCount('#bundlesSold', JingleJam.model.collections.redeemed, formatInt);
        setCount('#donationCount', JingleJam.model.donations.count, (x) => formatInt(x) + (!JingleJam.isFinished ? "+" : ""));
        setCount('#averageDonation', (isPounds ? avgPounds : avgDollars), (x) => formatCurrency(x, 2),);
    }

    var first = true;

    async function updateScreen() {
        //If update flag is set and enough time has passed, refresh the screen
        if ((JingleJam.update && getNextProcessDate() <= 0) || first) {
            JingleJam.model = await getTiltify();

            JingleJam.model.history.reverse();

            onUpdate();
            first = false;
        }
    }

    async function updateGraph() {
        if (JingleJam.update) {
            await getCurrent();
            await createGraph();
        }
    }

    function getNextProcessDate() {
        let now = new Date();
        let modelUpdateTime = JingleJam.model.date ? new Date(JingleJam.model.date) : new Date();

        return JingleJam.refreshTime - (now.getTime() - modelUpdateTime.getTime()) + JingleJam.waitTime;
    }

    async function graphLoop() {
        if (!JingleJam.isFinished) {
            setTimeout(function () {
                graphLoop();
                finishedLoading();
            }, JingleJam.graphTime);
        }

        toggleLiveUpdateSpinner(true);
        await updateGraph();
        toggleLiveUpdateSpinner(false);
    }

    async function realTimeLoop() {

        toggleLiveUpdateSpinner(true);
        try {
            await updateScreen();
        } catch { }
        toggleLiveUpdateSpinner(false);

        if (!JingleJam.isFinished) {
            setTimeout(function () {
                realTimeLoop();
                finishedLoading();
            }, Math.max(getNextProcessDate(), JingleJam.minRefreshTime));
        }
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

    async function getCurrent() {
        try {
            let response = await fetchWithTimeout(JingleJam.domain + '/api/current');

            let points = await response.json();

            for (let point of points) {
                point.time = new Date(Date.parse(point.timestamp + ' ' + JingleJam.model.year));
                point.x = point.time.getTime();
            }

            JingleJam.current = groupBy(points, x => x.year);
        }
        catch {
            JingleJam.current = [];
        }
    }

    async function getPrevious() {
        let points = await (await fetchWithTimeout(JingleJam.domain + '/api/previous')).json();

        for (let point of points) {
            point.time = new Date(point.timestamp);

            if (point.time.getMonth() < 10)
                point.x = point.time.setFullYear(JingleJam.model.year + 1);
            else
                point.x = point.time.setFullYear(JingleJam.model.year);
        }

        JingleJam.previous = groupBy(points, x => x.year);
    }

    const colors = {
        '2016': '#46bdc6',
        '2017': '#ab30c4',
        '2018': '#c1bc1f',
        '2019': '#71f437',
        '2020': '#ff0081',
        '2021': '#6967ff',
        '2022': '#6ba950'
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
                data: year[1].filter(x => x.time.getMonth() >= 11).map(function (m) { return { x: m.x, y: m[isPounds ? 'amountPounds' : 'amountDollars'] }; })
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
                data: year[1].map(function (m) { return { x: m.x, y: m[isPounds ? 'amountPounds' : 'amountDollars'] }; })
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
                            text: 'Day (GMT)'
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