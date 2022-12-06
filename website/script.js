(function(){
    let JingleJam = {
        model: {},
        previous: [],
        graph: [],
        refreshTime: 15000,
        update: true,
        year: 2022,
        domain: '.'
    };

    if(window.location.hostname.includes('jinglejam.co.uk') || 
        window.location.hostname.includes('squarespace.com')  || 
        window.location.hostname.includes('yogscast.com'))
        JingleJam.domain = 'https://dashboard.jinglejam.co.uk';

    let isPounds = localStorage.getItem('currency') !== 'false';

    async function onLoad(){
        if(isPounds){
            $('#currencyCheckbox').attr('checked', 'checked')
        }

        Chart.defaults.font.family = 'Montserrat';
        Chart.defaults.font.size = 14;

        toggleDollars(!isPounds);
        createEvents();
        toggleRefresh(true);

        await Promise.all([
            realTimeLoop(),
            getPrevious()
        ]);

        await graphLoop();

        show();
    };

    function show(){
        $('#loader').hide();
        $('#content').show()
    }

    function toggleDollars(type){
        if(type){
            $('.poundComponent').hide();
            $('.dollarComponent').show();
        }
        else{
            $('.dollarComponent').hide();
            $('.poundComponent').show();
        }
    }

    function toggleRefresh(bool){
        if(bool){
            $('#liveUpdatingRow .loader').show();
            $('#liveUpdatingRow .loading-circle').hide();
        }
        else{
            $('#liveUpdatingRow .loader').hide();
            $('#liveUpdatingRow .loading-circle').show();
        }
    }

    function isMobileChart(){
        return window.innerWidth < 675;
    }

    async function fetchWithTimeout(resource, timeout = 10000) {
        const controller = new AbortController();
        const fetchId = setTimeout(() => controller.abort(), timeout);
        const response = await fetch(resource, {
          signal: controller.signal  
        });
        clearTimeout(fetchId);
        return response;
      }

    const startHour = 17;
    const startDate = new Date('Dec 01 ' + JingleJam.year + ' ' + startHour + ':00:00');

    function createEvents(){
        $('#currencyCheckbox').checkbox({
            onChange: function(){
                let val = $('#currencyCheckbox').is(':checked');
                isPounds = val;
                localStorage.setItem('currency', val);
                
                toggleDollars(!val);
                setTable();
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
            document.addEventListener(visibilityChange, function(){
                JingleJam.update = !document[hidden];

                //updateScreen();
            }, false);
        }

        //Upload Speed Slider
        $('#dateRange').slider({
            min: 0,
            max: 744-startHour,
            start: 0,
            end: 744-startHour,
            step: 1,
            smooth: true,
            labelDistance: 24,
            interpretLabel: function(value) {
                let date = addHours(startDate, value);

                if(date.getHours() === 0) {
                    if(isMobileChart()){
                        if(date.getDate() % 2 === 0){
                            return date.getDate();
                        }
                    }
                    else
                        return date.getDate();
                }
                return "";
            },
            onChange: function(e, min, max){
                let minDate = addHours(startDate, min);
                let maxDate = addHours(startDate, max);
                updateStep(minDate.getTime(), maxDate.getTime());
            }
        });
    }

    function addHours(date, hours) {
        const dateCopy = new Date(date);
        dateCopy.setHours(dateCopy.getHours() + hours);
        return dateCopy;
    }
    

    async function getTiltify(){
        const response = await fetchWithTimeout(JingleJam.domain + '/api/tiltify');

        return await response.json();
    }

    function formatCurrency(total, currency = '$', decimals = 0, includeSpace = true) {
        let neg = false;
        if(total < 0) {
            neg = true;
            total = Math.abs(total);
        }

        let amount = 0
        if(decimals > 0)
            amount =  parseFloat(total, 10).toFixed(decimals).replace(/(\d)(?=(\d{3})+\.)/g, "$1,").toString();
        else
            amount = parseInt(total).toLocaleString("en-US");

        return (neg ? ("-" + currency) : currency) + (includeSpace ? " " : "") + amount;
    }

    function formatInt(x) {
        return parseInt(x).toLocaleString();
    }

    function animateCount(elem, target, format) {
        let number = parseFloat($(elem).data('value'));
        if(isNaN(number))
            number = 0;

        if(!target)
            target = 0;

        let incAmount = (target-number)/90;
        if(number < target) {
            let interval = setInterval(function() {
                $(elem).text(format(number));
                if (number >= target) {
                    clearInterval(interval);
                    $(elem).text(format(target));
                    $(elem).data('value', target);
                    return;
                }
                number+=incAmount;
            }, 17);
        }
        else{
            $(elem).data('value', target);
            $(elem).text(format(target));
        }
    }

    function setTable(){
        let table = ''

        let sortedCampaigns = JingleJam.model.campaigns.sort((a,b) => (a.name > b.name) ? 1 : ((b.name > a.name) ? -1 : 0))
        for(let campaign of sortedCampaigns){
            let yogscastAmount = isPounds ? formatCurrency(campaign.raised.pounds, '£', 2) : formatCurrency(campaign.raised.dollars, '$', 2);
            let isAllCharities = campaign.id === 566;

            table += `<tr class="${isAllCharities ? "light-blue-background" : ""}">`
            table += `<th label="Charity">${campaign.name}</th>`
            table += `<th label="Yogscast" class="right aligned jj-thin">${campaign.id === 566 ? yogscastAmount : '-'}</th>`
            table += `<th label="Fundraisers" class="right aligned jj-thin">${isPounds ? formatCurrency(campaign.fundraisers.pounds, '£', 2) : formatCurrency(campaign.fundraisers.dollars, '$', 2)}</th>`
            table += `<th label="Total" class="right aligned jj-thin">${isPounds ? formatCurrency(campaign.total.pounds, '£', 2) : formatCurrency(campaign.total.dollars, '$', 2)}</th>`
            table += '</tr>'
        }
        $('#charitiesTable tbody').html(table);
    }

    function getYear(year){
        for(let item of JingleJam.model.years){
            if(item.year === year)
                return item;
        }
        return {};
    }

    function onUpdate(){
        animateCount('#raisedYogscastDollars', JingleJam.model.raised.dollars, formatCurrency);
        animateCount('#raisedYogscastPounds', JingleJam.model.raised.pounds, (x) => formatCurrency(x, '£'));
        animateCount('#raisedFundraisersDollars', JingleJam.model.fundraisers.dollars, formatCurrency);
        animateCount('#raisedFundraisersPounds', JingleJam.model.fundraisers.pounds, (x) => formatCurrency(x, '£'));
        animateCount('#raisedTotalDollars', JingleJam.model.total.dollars, formatCurrency);
        animateCount('#raisedTotalPounds', JingleJam.model.total.pounds, (x) => formatCurrency(x, '£'));
        animateCount('#raisedEntireDollars', JingleJam.model.entire.amount.dollars, (x) => formatCurrency(x, '$'));
        animateCount('#raisedEntirePounds', JingleJam.model.entire.amount.pounds, (x) => formatCurrency(x, '£'));
        animateCount('#bundlesSold', JingleJam.model.bundles.sold, formatInt);
        animateCount('#donationCount', JingleJam.model.donations.count, (amount) => formatInt(amount) + "+");
        animateCount('#averageDonationDollars', JingleJam.model.average.dollars, (x) => formatCurrency(x, '$', 2));
        animateCount('#averageDonationPounds', JingleJam.model.average.pounds, (x) => formatCurrency(x, '£', 2));

        animateCount('#dollars2016', getYear(2016).total.dollars, (x) => formatCurrency(x, '$'));
        animateCount('#dollars2017', getYear(2017).total.dollars, (x) => formatCurrency(x, '$'));
        animateCount('#dollars2018', getYear(2018).total.dollars, (x) => formatCurrency(x, '$'));
        animateCount('#dollars2019', getYear(2019).total.dollars, (x) => formatCurrency(x, '$'));
        animateCount('#dollars2020', getYear(2020).total.dollars, (x) => formatCurrency(x, '$'));
        animateCount('#dollars2021', getYear(2021).total.dollars, (x) => formatCurrency(x, '$'));
        
        animateCount('#pounds2016', getYear(2016).total.pounds, (x) => formatCurrency(x, '£'));
        animateCount('#pounds2017', getYear(2017).total.pounds, (x) => formatCurrency(x, '£'));
        animateCount('#pounds2018', getYear(2018).total.pounds, (x) => formatCurrency(x, '£'));
        animateCount('#pounds2019', getYear(2019).total.pounds, (x) => formatCurrency(x, '£'));
        animateCount('#pounds2020', getYear(2020).total.pounds, (x) => formatCurrency(x, '£'));
        animateCount('#pounds2021', getYear(2021).total.pounds, (x) => formatCurrency(x, '£'));

        setTable();

        $('#labelDate').text('Last Updated: ' + new Date(JingleJam.model.date).toLocaleString());
    }

    async function updateScreen(){
        if (JingleJam.update) {
            JingleJam.model = await getTiltify();
        
            onUpdate();
        }
    }

    async function updateGraph(){
        if (JingleJam.update) {
            await getCurrent();
            await createGraph();
        }
    }

    async function graphLoop(){
        let time = 1000 * 60 * 10;
       // if(new Date(new Date('12/01/' + JingleJam.year + ' 18:00:00 GMT').toLocaleString("en-US", { timeZone: "GMT" })) >= new Date(new Date().toLocaleString("en-US", { timeZone: "GMT" })))
       //     time = 1000 * 60;

        setTimeout(function(){
            graphLoop();
            show();
        }, time);

        toggleRefresh(true);
        await updateGraph();
        toggleRefresh(false);
    }

    async function realTimeLoop(){
        setTimeout(function(){
            realTimeLoop();
            show();
        }, JingleJam.refreshTime);

        toggleRefresh(true);
        await updateScreen();
        toggleRefresh(false);
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

    function getInterpolatedValue(year, date = new Date(JingleJam.model.date)){
        let items = JingleJam.previous.get(year);
        let closeLess = null, closeGreater = null;

        for(let item of items){
            if(!closeLess && item.time <= date)
                closeLess = item
            else if(closeLess && item.time <= date && closeLess.time <= item.time)
                closeLess = item;
                
            if(!closeGreater && item.time >= date)
                closeGreater = item
            else if(closeGreater && item.time >= date && closeGreater.time >= item.time)
                closeGreater = item;
        }

        let response = {
            closeLess,
            closeGreater
        }

        if(!closeGreater){
            response.interpolated = {
                percent: 0,
                amountDollars: closeLess.amountDollars,
                amountPounds: closeLess.amountPounds
            }
        }
        else if(!closeLess){
            response.interpolated = {
                percent: 1,
                amountDollars: closeGreater.amountDollars,
                amountPounds: closeGreater.amountPounds
            }
        }
        else if(closeLess && closeGreater){
            let percent = (closeGreater.time - closeLess.time === 0) ? 0 : (date - closeLess.time)/(closeGreater.time - closeLess.time);
            response.interpolated = {
                percent: percent,
                amountDollars: (percent * (closeGreater.amountDollars - closeLess.amountDollars)) + closeLess.amountDollars,
                amountPounds: (percent * (closeGreater.amountPounds - closeLess.amountPounds)) + closeLess.amountPounds
            }
        }

        return response;
    }

    async function getCurrent(){
        try{
            let response = await fetchWithTimeout(JingleJam.domain + '/api/current', 5000);
        
            let points = await response.json();
            
            for(let point of points){
                point.time = new Date(Date.parse(point.timestamp + ' ' + JingleJam.year));
                point.x = point.time.getTime();
            }
        
            JingleJam.current = groupBy(points, x => x.year);
        }
        catch {
            JingleJam.current = [];
        }
    }

    async function getPrevious(){
        let points = await (await fetchWithTimeout(JingleJam.domain + '/api/previous', 60000)).json();
        
        for(let point of points){
            point.time = new Date(point.timestamp);

            if(point.time.getMonth() < 10)
                point.x = point.time.setFullYear(JingleJam.year+1);
            else
                point.x = point.time.setFullYear(JingleJam.year);
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
    let minDate = Date.parse('12/01/' + JingleJam.year + ' 17:00');
    let maxDate = Date.parse('01/01/' + (JingleJam.year+1) + ' 00:00');

    async function createGraph(){
        let data = {
            type: 'line',
            labels: new Set(),
            datasets: []
        }

        for(let year of JingleJam.previous){
            if(year[0] < 2017)
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
                data: year[1].filter(x => x.time.getMonth() >= 11).map(function(m) { return {x: m.x, y: m[isPounds ? 'amountPounds' : 'amountDollars']}; })
            })
        }
        
        for(let year of JingleJam.current){
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
                data: year[1].map(function(m) { return {x: m.x, y: m[isPounds ? 'amountPounds' : 'amountDollars']}; })
            })
        }

        if(myChart){
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
                        tension: .4
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
                        min: minDate,
                        max: maxDate,
                        grid: {
                            color: '#d4d4d4'
                        }
                    },
                    y: {
                        type: 'linear',
                        min: 0,
                        title: {
                            display: true,
                            text: 'Amount Raised'
                        },
                        ticks: {
                            // Include a dollar sign in the ticks
                            callback: function(value, index, ticks) {
                                if(value >= 1000000)
                                    return formatCurrency(value/1000000, isPounds ? '£' : '$', 1, false) + 'm'
                                else if(value >= 1000)
                                    return formatCurrency(value/1000, isPounds ? '£' : '$', 0, false) + 'k'

                                return formatCurrency(value, isPounds ? '£' : '$', 0, false);
                            }
                        },
                        grid: {
                            color: '#d4d4d4'
                        }
                    }
                },
                plugins: {
                    title: {
                        display: true,
                        text: 'Amount Raised Over Time'
                    },
                    tooltip: {
                        callbacks: {
                            label: function(tooltipItem, data) {
                                return ' ' + tooltipItem.dataset.label + ' - ' + formatCurrency(tooltipItem.raw.y, isPounds ? '£' : '$', 0, false) + ' (' + tooltipItem.label + ')';
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

        minDate = new Date(min);
        maxDate = new Date(max);
        
        myChart.options.scales.x.min = min
        myChart.options.scales.x.max = max
        myChart.update();
    }

    onLoad();
})();