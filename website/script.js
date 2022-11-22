let JingleJam = {
    model: {},
    refreshTime: 15000
};

let isPounds = localStorage.getItem('currency') !== 'false';

$(document).ready(async function(){
    if(isPounds){
        $('#currencyCheckbox').attr('checked', 'checked')
    }

    toggleDollars(!isPounds);
    createEvents();
    await callUpdates();
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
        }
    });
}

async function getTiltify(){
    const response = await fetch('./api/tiltify');

    return await response.json();
}

function formatCurrency(total, currency = '$', decimals = 2) {
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

    return (neg ? ("-" + currency) : currency) + " " + amount;
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

    var incAmount = (target-number)/120;
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
        table += `<td>${campaign.name}</td>`
        table += `<td class="right aligned">${isPounds ? formatCurrency(campaign.raised.pounds, '£') : formatCurrency(campaign.raised.dollars)}</td>`
        table += `<td class="right aligned">${isPounds ? formatCurrency(campaign.fundraisers.pounds, '£') : formatCurrency(campaign.fundraisers.dollars)}</td>`
        table += `<td class="right aligned">${isPounds ? formatCurrency(campaign.total.pounds, '£') : formatCurrency(campaign.total.dollars)}</td>`
        table += `<td class="right aligned">${formatInt(campaign.bundles.sold)}</td>`
        table += `<td class="right aligned">${formatInt(campaign.bundles.remaining)}</td>`
        table += '</tr>'
    }
    $('#charitiesTable tbody').html(table);
}

function onUpdate(){
    animateCount('#raisedYogscastDollars', JingleJam.model.raised.dollars, formatCurrency);
    animateCount('#raisedYogscastPounds', JingleJam.model.raised.pounds, (x) => formatCurrency(x, '£'));
    animateCount('#raisedFundraisersDollars', JingleJam.model.fundraisers.dollars, formatCurrency);
    animateCount('#raisedFundraisersPounds', JingleJam.model.fundraisers.pounds, (x) => formatCurrency(x, '£'));
    animateCount('#raisedTotalDollars', JingleJam.model.total.dollars, formatCurrency);
    animateCount('#raisedTotalPounds', JingleJam.model.total.pounds, (x) => formatCurrency(x, '£'));
    animateCount('#raisedEntireDollars', JingleJam.model.total.dollars + JingleJam.model.previous.dollars, (x) => formatCurrency(x, '$', 0));
    animateCount('#raisedEntirePounds', JingleJam.model.total.pounds + JingleJam.model.previous.pounds, (x) => formatCurrency(x, '£', 0));
    animateCount('#bundlesSold', JingleJam.model.bundles.sold, formatInt);
    animateCount('#donationCount', JingleJam.model.donations.count, (amount) => formatInt(amount) + "+");

    setTable();
}

async function callUpdates(){
    setTimeout(function(){
        callUpdates();
    }, JingleJam.refreshTime);
    
    JingleJam.model = await getTiltify();

    onUpdate();
}