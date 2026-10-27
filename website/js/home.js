(function () {
    let JingleJam = {
        domain: '',                 //Root-relative, since the page is served at /home
    };

    //On page setup
    async function onLoad() {
        //Domain lookup
        if (window.location.hostname.includes('jinglejam.co.uk') ||
            window.location.hostname.includes('squarespace.com') ||
            window.location.hostname.includes('yogscast.com'))
            JingleJam.domain = 'https://dashboard.jinglejam.co.uk';

        //The page can be embedded on other sites, so load the logo and link to pages on the tracker's domain
        $('#jjLogo').attr('src', JingleJam.domain + '/assets/jingle-jam-2026-logo.webp');
        $('#embedContainer a[href^="/"]').each(function () {
            $(this).attr('href', JingleJam.domain + $(this).attr('href'));
        });

        JingleJamSearch.create(document.getElementById('searchBox'), {
            domain: JingleJam.domain,
            getUrl: result => JingleJamSearch.getPageUrl(result, JingleJam.domain),
            autofocus: true,
        });

        await loadCauses();
    }

    //Shows each cause's bordered logo, linking to its page
    async function loadCauses() {
        let data;
        try {
            data = await (await fetch(JingleJam.domain + '/api/v1/causes')).json();
        } catch {
            $('#causesError').show();
            return;
        }

        $('.jj-year').text(data.meta.event.year);

        let causes = data.causes.slice().sort((a, b) => a.name.localeCompare(b.name));

        $('#causeLogos').html(causes.map(cause => `
            <a class="home-cause" href="${escapeHtml(JingleJam.domain + '/causes/' + encodeURIComponent(cause.slug))}" title="${escapeHtml(cause.name)}" aria-label="${escapeHtml(cause.name)}">
              <img src="${escapeHtml(safeUrl(cause.borderedLogo || cause.logo))}" alt="${escapeHtml(cause.name)}">
            </a>`).join(''));
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

    onLoad();
})();
