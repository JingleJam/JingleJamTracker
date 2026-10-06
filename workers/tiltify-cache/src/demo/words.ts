// Word lists for the demo's generated fundraisers. Every name is made up.

export const CAMPAIGN_PREFIXES = [
    'Cosy', 'Festive', 'Frosty', 'Merry', 'Snowy', 'Jolly', 'Twinkly', 'Midnight', 'Winter', 'Gingerbread',
    'Candlelit', 'Tinsel', 'Yuletide', 'Mistletoe', 'Sleigh Bell', 'Fireside', 'Snowglobe', 'Starlit',
] as const;

export const CAMPAIGN_ACTIVITIES = [
    'Charity Stream', 'Marathon', 'Game Night', 'Speedrun Showdown', 'Bake-Off', 'Board Game Bash', 'Retro Rumble',
    'Quiz Night', 'Craft-a-thon', 'Karaoke', 'Build Battle', 'Racing League', 'Puzzle Party', 'Horror Night',
    'Art Stream', 'Music Jam', 'D&D One-Shot', 'Cook-Along', 'Walk-a-thon', 'Pixel Party', 'Trivia Takeover',
] as const;

export const CAMPAIGN_SUFFIXES = [
    '', '', '', 'for Jingle Jam', 'with Friends', '- 24 Hours!', '(Day 1)', 'Extravaganza', 'Returns',
] as const;

export const USER_FIRST = [
    'Pixel', 'Snow', 'Cocoa', 'Tinsel', 'Frost', 'Holly', 'Ginger', 'Pudding', 'Cranberry', 'Starlight',
    'Sprout', 'Bauble', 'Comet', 'Velvet', 'Nimbus', 'Maple', 'Quill', 'Ember', 'Juniper', 'Marble',
] as const;

export const USER_SECOND = [
    'Panda', 'Fox', 'Otter', 'Gamer', 'Plays', 'Builds', 'TV', 'Live', 'Bakes', 'Owl', 'Knight', 'Wizard',
    'Badger', 'Moth', 'Streams', 'Hedgehog', 'Bard', 'Robin',
] as const;

// The first teams run team events (the first is the biggest fundraiser), the rest are teams without one
export const TEAM_NAMES = [
    'The Tinsel Crew', 'Cocoa Collective', 'North Pole Gaming', 'Snowfall Squad', 'The Gingerbread Guild',
    'Frostbite Friends', 'Merry Makers', 'Sleigh Riders', 'The Pudding Club',
] as const;

export const TEAM_EVENT_TITLES = [
    'Christmas Marathon', 'Winter Takeover', 'Festive Fortnight', 'Holiday Charity Weekend', 'Big Jingle Stream',
] as const;

export const DESCRIPTION_SENTENCES = [
    'Join us for a festive stream raising money for this year\'s Jingle Jam charities.',
    'Every donation goes straight to the causes, and every £35 gets you the Jingle Jam Games Collection.',
    'We\'ll be playing games, chatting and generally being merry until we drop.',
    'Donation goals unlock silly challenges on stream, so keep an eye on the goal list!',
    'Thanks to everyone who has supported us over the years. Let\'s make this the biggest one yet.',
    'Expect cosy vibes, questionable singing and far too many mince pies.',
    'Pick a charity and help us hit our goal before the end of the event.',
] as const;

export const SPONSORS = [
    'Cosy Co.', 'Snowflake Studios', 'An Anonymous Elf', 'The Pudding Fund', 'Starlight Games', 'Frosty Foods',
] as const;

export const DONOR_NAMES = [
    'Anonymous', 'Anonymous', 'Anonymous', 'Holly', 'Sam', 'Alex', 'Jo', 'Robin', 'Charlie', 'Frosty Fan',
    'A Kind Stranger', 'Sprout Enjoyer', 'Mince Pie Collector', 'Taylor', 'Morgan', 'Jamie', 'Riley', 'Casey',
    'Snowball', 'Mistletoe Mo', 'GingerSnap', 'Present Wrapper', 'CocoaLover99',
] as const;

export const DONATION_AMOUNTS = [3, 5, 5, 10, 10, 10, 15, 20, 20, 25, 35, 35, 35, 35, 50, 50, 100, 12.34, 250] as const;

export const DONATION_COMMENTS = [
    'Merry Christmas!',
    'Good luck with the stream!',
    'For the collection 🎮',
    'Keep it up!',
    'Happy to help such great causes ❤️',
    'First time donating, love the stream',
    'Do the challenge!!',
    'Ünïcödé test — 日本語 — 🎄🎁✨',
    '<b>Not bold</b> & definitely not <script>alert("hi")</script>',
    'This is a much longer comment to check how the latest donations list copes with text that goes on for a while. '
        + 'I have been watching every year since the very beginning and it is always the highlight of my December, '
        + 'so here is a little something for the charities. Have a lovely Christmas everyone!',
] as const;

export const REWARD_NAMES = [
    'Shout-out on stream', 'Name in the credits', 'Choose the next game', 'Signed postcard', 'Custom emote',
    'Sing a song of your choice', 'Join a game with me', 'Festive drawing', 'Pick my Christmas jumper',
] as const;

export const REWARD_DESCRIPTIONS = [
    '',
    'I\'ll read your name out live on stream.',
    'A hand-drawn festive doodle of your choice, sent by email after the event.',
    'Limited run, so be quick! Delivered in January.',
] as const;
