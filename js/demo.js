/* Generates a realistic-looking fake export so people can try the site. */
(function (global) {
  'use strict';

  function rng(seed) {
    return function () {
      seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function makeDemo() {
    const r = rng(42);
    const usage = { app_opens: {}, swipes_likes: {}, swipes_passes: {}, superlikes: {}, matches: {}, messages_sent: {}, messages_received: {} };
    const end = new Date();
    const start = new Date(end); start.setMonth(start.getMonth() - 26);
    const openers = [
      'Hey! How was your weekend?', 'Hi there, love your dog 🐶', 'Okay important question: pineapple on pizza?',
      'Hey, that hiking photo looks amazing, where was it?', 'Hi! What are you reading lately?',
      'Hey how is your week going?', 'Two truths and a lie, go', 'Hey! Best taco spot in town?',
      'Hi :) you seem fun', 'Hey, coffee or tea person?'];
    const replies = ['haha yes', 'that sounds great', 'what are you up to this weekend?', 'no way!', 'I have been there too',
      'want to grab a drink sometime?', 'lol', 'that is hilarious', 'how about Thursday?', 'sounds good to me'];
    const messages = [];
    let matchNo = 0;

    // Activity waves: active bursts and quiet breaks
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const key = d.toISOString().slice(0, 10);
      const month = d.getMonth();
      const phase = Math.sin((d - start) / (1000 * 3600 * 24 * 60));
      const active = phase > -0.4 && r() > 0.25;
      if (!active) continue;
      const weekend = d.getDay() === 0 || d.getDay() >= 5 ? 1.5 : 1;
      const level = (0.6 + phase * 0.5) * weekend * (month === 0 ? 1.4 : 1);
      const opens = Math.round((2 + r() * 8) * level);
      const likes = Math.round((5 + r() * 40) * level);
      const passes = Math.round((10 + r() * 70) * level);
      const matches = Array.from({ length: likes }).reduce(a => a + (r() < 0.045 ? 1 : 0), 0);
      usage.app_opens[key] = opens;
      usage.swipes_likes[key] = likes;
      usage.swipes_passes[key] = passes;
      if (r() < 0.08) usage.superlikes[key] = 1;
      if (matches) usage.matches[key] = matches;

      for (let i = 0; i < matches; i++) {
        matchNo++;
        const convo = [];
        if (r() > 0.35) {
          const len = Math.max(1, Math.floor(Math.pow(r(), 2.2) * 40));
          const t = new Date(d);
          t.setHours(Math.floor(r() < 0.7 ? 18 + r() * 6 : 8 + r() * 10), Math.floor(r() * 60));
          for (let j = 0; j < len; j++) {
            const text = j === 0 ? openers[Math.floor(r() * openers.length)] : replies[Math.floor(r() * replies.length)];
            convo.push({ to: matchNo, from: 'You', message: text, sent_date: t.toUTCString() });
            const tk = t.toISOString().slice(0, 10);
            usage.messages_sent[tk] = (usage.messages_sent[tk] || 0) + 1;
            if (r() > 0.3) usage.messages_received[tk] = (usage.messages_received[tk] || 0) + 1 + Math.floor(r() * 2);
            t.setMinutes(t.getMinutes() + Math.floor(r() * 600));
          }
        }
        messages.push({ match_id: 'Match ' + matchNo, messages: convo });
      }
    }

    return {
      User: {
        birth_date: '1995-06-15T00:00:00.000Z',
        create_date: start.toISOString(),
        gender: 'M',
        interested_in: 'F',
        age_filter_min: 23,
        age_filter_max: 33,
        city: { name: 'Sample City' },
      },
      Usage: usage,
      Messages: messages,
    };
  }

  global.TinderDemo = { makeDemo };
})(window);
