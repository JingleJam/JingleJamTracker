let JingleJam = {
    model: {},
    refreshTime: 15000,
    update: true
};

let isPounds = localStorage.getItem('currency') !== 'false';

$(document).ready(async function(){
    if(isPounds){
        $('#currencyCheckbox').attr('checked', 'checked')
    }

    toggleDollars(!isPounds);
    createEvents();
    await eventLoop();
    show();
});

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

function createEvents(){
    $('#watchLive').on('click', function(e) {
        window.open('https://twitch.tv/yogscast', "_blank");
    });
    $('#donate').on('click', function(e) {
        window.open('https://jinglejam.tiltify.com/', "_blank");
    });
    $('#previousYears').on('click', function(e) {
        window.open('https://docs.google.com/spreadsheets/d/11Ua2EVlmLCtMKSwKDHnLI8jGvkgJV8BMMHZ1sWowRn0/edit#gid=161223743', "_blank");
    });
    $('#learnMore').on('click', function(e) {
        window.open('https://www.jinglejam.co.uk/', "_blank");
    });

    $('#currencyCheckbox').checkbox({
        onChange: function(){
            let val = $('#currencyCheckbox').is(':checked');
            isPounds = val;
            localStorage.setItem('currency', val);
            
            toggleDollars(!val);
            setTable();
            updateProcess();
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

            updateScreen();
        }, false);
    }
}

async function getTiltify(){
    const response = await fetch('./api/tiltify');

    return await response.json();
}

function formatCurrency(total, currency = '$', decimals = 0, includeSpace = true) {
    var neg = false;
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

    var incAmount = (target-number)/90;
    if(number < target) {
        var interval = setInterval(function() {
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
}

function setTable(){
    let table = ''

    let sortedCampaigns = JingleJam.model.campaigns.sort((a,b) => (a.name > b.name) ? 1 : ((b.name > a.name) ? -1 : 0))
    for(let campaign of sortedCampaigns){
        table += '<tr>'
        table += `<td label="Charity" >${campaign.name}</td>`
        table += `<td label="Yogscast" class="right aligned">${isPounds ? formatCurrency(campaign.raised.pounds, '£', 2) : formatCurrency(campaign.raised.dollars, '$', 2)}</td>`
        table += `<td label="Fundraiser" class="right aligned">${isPounds ? formatCurrency(campaign.fundraisers.pounds, '£', 2) : formatCurrency(campaign.fundraisers.dollars, '$', 2)}</td>`
        table += `<td label="Total" class="right aligned">${isPounds ? formatCurrency(campaign.total.pounds, '£', 2) : formatCurrency(campaign.total.dollars, '$', 2)}</td>`
        table += `<td label="Bundles Sold" class="right aligned">${formatInt(campaign.bundles.sold)}</td>`
        table += `<td label="Bundles Remain" class="right aligned">${formatInt(campaign.bundles.remaining)}</td>`
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
    animateCount('#bundlesSold', JingleJam.model.bundles.remaining, formatInt);
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

    updateProcess();
}

function updateProcess(){
    return;
    
    let goal = JingleJam.model.goal.amount;

    let percent = JingleJam.model.goal.currency === 'pounds' ? (JingleJam.model.raised.pounds/goal) : (JingleJam.model.raised.dollars/goal);

    let goalAdjusted = 0;
    let left = 0;
    if(isPounds){
        goalAdjusted = (1.0/percent) * JingleJam.model.raised.pounds;
        left = goal - JingleJam.model.raised.pounds;
    }
    else{
        goalAdjusted = (1.0/percent) * JingleJam.model.raised.dollars;
        left = goal - JingleJam.model.raised.dollars;
    }

    console.log(left);

    let text = JingleJam.model.goal.text.replace('{amount}', formatCurrency(Math.round(goalAdjusted), isPounds ? '£' : '$', 0, false));
    let success = JingleJam.model.goal.success.replace('{amount}', formatCurrency(Math.round(goalAdjusted), isPounds ? '£' : '$', 0, false));
    let percentText = `{percent}% - ${formatCurrency(Math.round(left), isPounds ? '£' : '$', 0, false)}`

    $('#goalProgress').progress({
        percent: percent*100,
        precision: 1,
        text: {
          active  : text,
          success : success,
          percent : percentText
        }
    });
}

async function updateScreen(){
    if (JingleJam.update) {
        JingleJam.model = await getTiltify();
    
        onUpdate();
    }
}

async function eventLoop(){
    setTimeout(function(){
        eventLoop();
    }, JingleJam.refreshTime);
    
    updateScreen();
}
