/**
 * Lore system chat message override
 * Replaces the default Foundry chat message header/content with a custom layout
 * while preserving message controls functionality.
 */

// Updated for Foundry VTT v13+: use renderChatMessageHTML (HTMLElement instead of jQuery)
Hooks.on('renderChatMessageHTML', async (message, html, data) => {
  try {
    // Tag the parent <li.message.chat-message> so our CSS can target it safely
    html.classList?.add('lore-chat');

    // Extract current content and controls from the rendered message
    // html is an HTMLElement (the <li class="message"> root)
    const contentEl = html.querySelector('.message-content');
    const originalContentHTML = contentEl?.innerHTML ?? '';
    const controls = html.querySelector('.message-controls');

    // Build author and timing context
  const speaker = message.speaker ?? {};
  // Foundry VTT v12+: ChatMessage#user migrated to ChatMessage#author (User document)
  const userDoc = message.author ?? null;
    const actor = speaker.actor ? game.actors.get(speaker.actor) : null;
    const authorName = message.alias || speaker.alias || userDoc?.name || 'Unknown';
    const authorImg = speaker.img || actor?.img || userDoc?.avatar || 'icons/svg/mystery-man.svg';

    const ts = Number(message.timestamp ?? Date.now());
    const lang = game.i18n?.lang || navigator.language || 'en-US';
    const timestamp = new Date(ts).toLocaleTimeString(lang, { hour: '2-digit', minute: '2-digit' });

  // Flags and tags
    // Normalize message visibility fields across Foundry versions (v10-v13)
    const isBlind = !!message.blind;
    const isRoll = (Array.isArray(message.rolls) && message.rolls.length > 0) || !!html.querySelector('.dice-roll');

    // Resolve whisper recipients to an array of user IDs
    let whisperIds = [];
    try {
      if (typeof message.getWhisperRecipients === 'function') {
        // v12+ helper returns User[]
        whisperIds = (message.getWhisperRecipients() ?? []).map(u => u?.id).filter(Boolean);
      } else if (message.recipients) {
        // Some versions expose recipients as a Set/array of Users
        const recips = message.recipients instanceof Set ? Array.from(message.recipients) : message.recipients;
        whisperIds = (recips ?? []).map(u => u?.id ?? u).filter(Boolean);
      } else if (message.whisper instanceof Set) {
        whisperIds = Array.from(message.whisper);
      } else if (Array.isArray(message.whisper)) {
        whisperIds = message.whisper;
      } else if (typeof message.whisper === 'string' && message.whisper.length) {
        whisperIds = [message.whisper];
      }
    } catch (e) {
      console.warn('Lore | Unable to normalize whisper recipients:', e);
      whisperIds = Array.isArray(message.whisper) ? message.whisper : [];
    }
    const isWhisper = whisperIds.length > 0;
  const rollType = message?.flags?.lore?.rollType || null;
  const rollName = message?.flags?.lore?.rollName || null;

    // Compute a single, human-friendly visibility label for roll messages
    let visibilityLabel = null;
    const tags = [];
    try {
      if (isRoll) {
        const authorId = (message.author?.id) || (message.user?.id) || (typeof message.user === 'string' ? message.user : null);
        const gmIds = (game.users ?? []).filter(u => u.isGM).map(u => u.id);

        // Evaluate whisper target composition
        const onlyGMs = whisperIds.length > 0 && whisperIds.every(id => gmIds.includes(id));
        const toSelf = whisperIds.length === 1 && authorId && whisperIds[0] === authorId;

        if (isBlind && onlyGMs) visibilityLabel = 'Blind GM';
        else if (onlyGMs) visibilityLabel = 'Private GM';
        else if (toSelf) visibilityLabel = 'Self';
        else if (!isWhisper) visibilityLabel = 'Public';
        else visibilityLabel = 'Private';
      } else {
        // Non-roll messages keep the old tag behavior
        if (isWhisper) tags.push('Whisper');
        if (isBlind) tags.push('Blind');
      }
    } catch (e) {
      // Fallback to previous behavior on any unexpected error
      if (isRoll) tags.push('Roll');
      if (isWhisper) tags.push('Whisper');
      if (isBlind) tags.push('Blind');
      console.warn('Lore | Failed to compute visibility label:', e);
    }

    // Render our custom partial
    const context = {
      author: { name: authorName, img: authorImg },
      // We no longer render timestamp under the author; instead show roll type if available
      // timestamp,
      rollType,
      rollName,
      visibilityLabel,
      tags,
      content: originalContentHTML,
    };

  const rendered = await foundry.applications.handlebars.renderTemplate('systems/lore/templates/chat/message.hbs', context);

    // Replace the message content with our custom layout
    // Keep the outer <li.message> to preserve Foundry internals/behaviors
    html.innerHTML = '';
    // Turn the rendered string into DOM nodes
    const tpl = document.createElement('template');
    tpl.innerHTML = rendered.trim();
    const customRoot = tpl.content.firstElementChild;

    // Re-attach controls (delete/share/pin/etc.) inside our header area
    if (controls) {
      const controlsTarget = customRoot.querySelector('.lcm-controls');
      if (controlsTarget) controlsTarget.appendChild(controls);
      else customRoot.appendChild(controls);
    }

    html.appendChild(customRoot);
  } catch (err) {
    console.error('Lore | Chat message override failed:', err);
  }
});
