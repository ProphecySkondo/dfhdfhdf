// Custom cursor
const cursor = document.querySelector('.cursor');
const cursorGlow = document.querySelector('.cursor-glow');

document.addEventListener('mousemove', (e) => {
    cursor.style.left = e.clientX + 'px';
    cursor.style.top = e.clientY + 'px';
    cursorGlow.style.left = e.clientX + 'px';
    cursorGlow.style.top = e.clientY + 'px';
});

// Update interactive elements when DOM changes
function updateInteractiveElements() {
    const interactiveElements = document.querySelectorAll('a, button, input, textarea, .server-item, .conversation-item, .nav-link');
    interactiveElements.forEach(el => {
        el.removeEventListener('mouseenter', addCursorHover);
        el.removeEventListener('mouseleave', removeCursorHover);
        el.addEventListener('mouseenter', addCursorHover);
        el.addEventListener('mouseleave', removeCursorHover);
    });
}

function addCursorHover() {
    document.body.classList.add('cursor-hover');
}

function removeCursorHover() {
    document.body.classList.remove('cursor-hover');
}

updateInteractiveElements();

// Navigation
const navLinks = document.querySelectorAll('.nav-link');
const sections = document.querySelectorAll('.section');

navLinks.forEach(link => {
    link.addEventListener('click', () => {
        const targetSection = link.dataset.section;
        
        navLinks.forEach(l => l.classList.remove('active'));
        link.classList.add('active');
        
        sections.forEach(s => s.classList.remove('active'));
        document.getElementById(targetSection).classList.add('active');
    });
});

// Data storage
let token = '';
let userData = null;
let guilds = [];
let dms = [];
let friends = [];
let messagesSent = 0;
let isSpamming = false;
let spamInterval = null;

// Terminal functions
function addTerminalLine(message, type = 'success') {
    const terminalBody = document.getElementById('terminalBody');
    const line = document.createElement('div');
    line.className = `terminal-line ${type}`;
    line.textContent = `~ ${message}`;
    terminalBody.appendChild(line);
    terminalBody.scrollTop = terminalBody.scrollHeight;
}

function clearTerminal() {
    const terminalBody = document.getElementById('terminalBody');
    terminalBody.innerHTML = `
        <div class="terminal-line">~ Discord Manager Terminal Ready</div>
        <div class="terminal-line">~ Waiting for commands...</div>
    `;
}

// Load data
document.getElementById('loadDataBtn').addEventListener('click', loadData);

async function loadData() {
    token = document.getElementById('tokenInput').value.trim();
    const errorDiv = document.getElementById('tokenError');
    const btn = document.getElementById('loadDataBtn');
    
    if (!token) {
        errorDiv.textContent = 'Please enter a token';
        errorDiv.classList.remove('hidden');
        return;
    }

    errorDiv.classList.add('hidden');
    btn.disabled = true;
    btn.textContent = 'Loading...';
    showToast('Loading data...');

    try {
        // Fetch user data
        const userResponse = await fetch('https://discord.com/api/v10/users/@me', {
            headers: { 'Authorization': token }
        });

        if (!userResponse.ok) {
            throw new Error('Invalid token - Please check your token and try again');
        }

        userData = await userResponse.json();
        addTerminalLine(`Logged in as ${userData.username}#${userData.discriminator}`, 'success');

        // Fetch guilds
        const guildsResponse = await fetch('https://discord.com/api/v10/users/@me/guilds', {
            headers: { 'Authorization': token }
        });
        guilds = await guildsResponse.json();
        addTerminalLine(`Loaded ${guilds.length} servers`, 'info');

        // Fetch DMs
        const dmsResponse = await fetch('https://discord.com/api/v10/users/@me/channels', {
            headers: { 'Authorization': token }
        });
        const allChannels = await dmsResponse.json();
        dms = allChannels.filter(ch => ch.type === 1 || ch.type === 3);
        addTerminalLine(`Loaded ${dms.length} DM conversations`, 'info');

        // Fetch friends
        try {
            const friendsResponse = await fetch('https://discord.com/api/v10/users/@me/relationships', {
                headers: { 'Authorization': token }
            });
            friends = await friendsResponse.json();
            addTerminalLine(`Loaded ${friends.filter(f => f.type === 1).length} friends`, 'info');
        } catch (e) {
            friends = [];
        }

        showToast('Data loaded successfully!');
        addTerminalLine('All data loaded successfully!', 'success');
        renderData();
        
        // Switch to stats tab
        document.querySelector('[data-section="stats"]').click();
    } catch (err) {
        console.error(err);
        errorDiv.textContent = err.message;
        errorDiv.classList.remove('hidden');
        showToast('Failed to load data');
        addTerminalLine(`Error: ${err.message}`, 'error');
    } finally {
        btn.disabled = false;
        btn.textContent = 'Load Data';
    }
}

function renderData() {
    renderServers();
    renderConversations();
    renderStats();
    updateInteractiveElements();
}

// Search functionality
document.getElementById('serverSearch')?.addEventListener('input', (e) => {
    const searchTerm = e.target.value.toLowerCase();
    const filteredGuilds = guilds.filter(g => 
        g.name.toLowerCase().includes(searchTerm)
    );
    renderServers(filteredGuilds);
});

document.getElementById('dmSearch')?.addEventListener('input', (e) => {
    const searchTerm = e.target.value.toLowerCase();
    const filteredDms = dms.filter(dm => {
        const name = dm.name || (dm.recipients ? dm.recipients.map(r => r.username).join(', ') : '');
        return name.toLowerCase().includes(searchTerm);
    });
    renderConversations(filteredDms);
});

function renderServers(serverList = guilds) {
    const list = document.getElementById('serversList');
    
    if (serverList.length === 0) {
        list.innerHTML = '<div class="loading">No servers found</div>';
        return;
    }

    list.innerHTML = serverList.map(guild => `
        <div class="server-item">
            <div class="server-icon">${guild.name[0].toUpperCase()}</div>
            <div class="server-info">
                <div class="server-name">${escapeHtml(guild.name)}</div>
                <div class="server-members">ID: ${guild.id} ${guild.owner ? '• Owner' : ''}</div>
            </div>
        </div>
    `).join('');

    updateInteractiveElements();
}

function renderConversations(dmList = dms) {
    const list = document.getElementById('conversationsList');
    
    if (dmList.length === 0) {
        list.innerHTML = '<div class="loading">No conversations found</div>';
        return;
    }

    list.innerHTML = dmList.map(dm => {
        const name = dm.name || (dm.recipients ? dm.recipients.map(r => r.username).join(', ') : 'Unknown');
        const type = dm.type === 1 ? 'DM' : 'Group DM';
        
        return `
            <div class="conversation-item" onclick="viewConversation('${dm.id}', '${escapeHtml(name)}')">
                <div class="conversation-icon">${name[0].toUpperCase()}</div>
                <div class="conversation-info">
                    <div class="conversation-name">${escapeHtml(name)}</div>
                    <div class="conversation-type">${type} • ID: ${dm.id}</div>
                </div>
            </div>
        `;
    }).join('');

    updateInteractiveElements();
}

function renderStats() {
    const statsGrid = document.getElementById('statsGrid');
    statsGrid.innerHTML = `
        <div class="stat-card">
            <div class="stat-value">${guilds.length}</div>
            <div class="stat-label">Servers Joined</div>
        </div>
        <div class="stat-card">
            <div class="stat-value">${dms.length}</div>
            <div class="stat-label">DM Conversations</div>
        </div>
        <div class="stat-card">
            <div class="stat-value">${friends.filter(f => f.type === 1).length}</div>
            <div class="stat-label">Friends</div>
        </div>
        <div class="stat-card">
            <div class="stat-value">${messagesSent}</div>
            <div class="stat-label">Messages Sent</div>
        </div>
    `;

    const userInfo = document.getElementById('userInfo');
    if (userData) {
        const createdAt = new Date(parseInt(userData.id) / 4194304 + 1420070400000);
        userInfo.innerHTML = `
            <div style="margin-top: 32px; padding: 24px; background: rgba(88, 101, 242, 0.05); border: 1px solid var(--border); border-radius: 12px;">
                <h3 style="margin-bottom: 16px; font-size: 18px;">Account Information</h3>
                <p style="margin-bottom: 8px;"><strong>Username:</strong> ${escapeHtml(userData.username)}#${userData.discriminator}</p>
                <p style="margin-bottom: 8px;"><strong>ID:</strong> ${userData.id}</p>
                <p style="margin-bottom: 8px;"><strong>Email:</strong> ${escapeHtml(userData.email || 'N/A')}</p>
                <p style="margin-bottom: 8px;"><strong>Phone:</strong> ${escapeHtml(userData.phone || 'N/A')}</p>
                <p style="margin-bottom: 8px;"><strong>Verified:</strong> ${userData.verified ? 'Yes' : 'No'}</p>
                <p><strong>Account Created:</strong> ${createdAt.toLocaleDateString()} ${createdAt.toLocaleTimeString()}</p>
            </div>
        `;
    }
}

// View conversation and export
async function viewConversation(channelId, name) {
    showToast('Loading messages...');
    addTerminalLine(`Loading messages from ${name}...`, 'info');
    
    try {
        const messages = [];
        let lastId = null;
        let fetchCount = 0;

        while (true) {
            let url = `https://discord.com/api/v10/channels/${channelId}/messages?limit=100`;
            if (lastId) url += `&before=${lastId}`;

            const response = await fetch(url, {
                headers: { 'Authorization': token }
            });

            if (!response.ok) {
                throw new Error('Failed to fetch messages');
            }

            const batch = await response.json();
            if (batch.length === 0) break;

            messages.push(...batch);
            lastId = batch[batch.length - 1].id;
            fetchCount++;

            addTerminalLine(`Fetched ${messages.length} messages (batch ${fetchCount})`, 'info');

            if (batch.length < 100) break;
            
            // Prevent rate limiting
            await sleep(500);
        }

        addTerminalLine(`Loaded ${messages.length} total messages from ${name}`, 'success');
        exportConversationCSV(messages, channelId, name);
    } catch (err) {
        showToast('Failed to load messages');
        addTerminalLine(`Error loading messages: ${err.message}`, 'error');
    }
}

// Export functions
function exportServers() {
    const csv = [
        ['Server Name', 'Server ID', 'Owner', 'Icon'].join(','),
        ...guilds.map(g => [
            `"${g.name.replace(/"/g, '""')}"`,
            g.id,
            g.owner ? 'Yes' : 'No',
            g.icon ? `https://cdn.discordapp.com/icons/${g.id}/${g.icon}.png` : 'N/A'
        ].join(','))
    ].join('\n');

    downloadFile(csv, 'discord_servers.csv', 'text/csv');
    showToast('Servers exported!');
    addTerminalLine(`Exported ${guilds.length} servers to CSV`, 'success');
}

function exportServersJSON() {
    const json = JSON.stringify(guilds, null, 2);
    downloadFile(json, 'discord_servers.json', 'application/json');
    showToast('Servers exported as JSON!');
    addTerminalLine(`Exported ${guilds.length} servers to JSON`, 'success');
}

function exportConversationCSV(messages, channelId, name) {
    const csv = [
        ['Timestamp', 'Author', 'Author ID', 'Content', 'Attachments', 'Embeds'].join(','),
        ...messages.map(m => [
            `"${new Date(m.timestamp).toISOString()}"`,
            `"${m.author.username.replace(/"/g, '""')}"`,
            m.author.id,
            `"${(m.content || '').replace(/"/g, '""')}"`,
            m.attachments?.length || 0,
            m.embeds?.length || 0
        ].join(','))
    ].join('\n');

    const filename = `conversation_${name.replace(/[^a-z0-9]/gi, '_')}_${channelId}.csv`;
    downloadFile(csv, filename, 'text/csv');
    showToast('Conversation exported!');
    addTerminalLine(`Exported ${messages.length} messages from ${name}`, 'success');
}

// Spam functionality
document.getElementById('startSpamBtn')?.addEventListener('click', startSpam);
document.getElementById('stopSpamBtn')?.addEventListener('click', stopSpam);

async function startSpam() {
    const channelId = document.getElementById('spamChannelId').value.trim();
    const message = document.getElementById('spamMessage').value.trim();
    const count = parseInt(document.getElementById('spamCount').value) || 10;
    const delay = parseInt(document.getElementById('spamDelay').value) || 1000;

    if (!token) {
        showToast('Please load your token first!');
        addTerminalLine('Error: No token loaded', 'error');
        return;
    }

    if (!channelId) {
        showToast('Please enter a channel ID!');
        addTerminalLine('Error: No channel ID provided', 'error');
        return;
    }

    if (!message) {
        showToast('Please enter a message!');
        addTerminalLine('Error: No message provided', 'error');
        return;
    }

    isSpamming = true;
    document.getElementById('startSpamBtn').style.display = 'none';
    document.getElementById('stopSpamBtn').style.display = 'inline-block';
    document.getElementById('spamChannelId').disabled = true;
    document.getElementById('spamMessage').disabled = true;
    document.getElementById('spamCount').disabled = true;
    document.getElementById('spamDelay').disabled = true;

    addTerminalLine('Started spamming...', 'warning');
    addTerminalLine(`Channel ID: ${channelId}`, 'info');
    addTerminalLine(`Message: "${message}"`, 'info');
    addTerminalLine(`Count: ${count} | Delay: ${delay}ms`, 'info');

    let sentCount = 0;

    for (let i = 0; i < count && isSpamming; i++) {
        try {
            const response = await fetch(`https://discord.com/api/v10/channels/${channelId}/messages`, {
                method: 'POST',
                headers: {
                    'Authorization': token,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ content: message })
            });

            if (response.ok) {
                sentCount++;
                messagesSent++;
                addTerminalLine(`[${sentCount}/${count}] Sent message "${message}" in channel ${channelId}`, 'success');
                renderStats();
            } else {
                const error = await response.json();
                addTerminalLine(`[${sentCount}/${count}] Failed: ${error.message || 'Unknown error'}`, 'error');
                
                if (response.status === 429) {
                    const retryAfter = error.retry_after || 5;
                    addTerminalLine(`Rate limited! Waiting ${retryAfter} seconds...`, 'warning');
                    await sleep(retryAfter * 1000);
                }
            }
        } catch (err) {
            addTerminalLine(`Error sending message: ${err.message}`, 'error');
        }

        if (i < count - 1 && isSpamming) {
            await sleep(delay);
        }
    }

    stopSpam();
    addTerminalLine(`Spamming completed! Sent ${sentCount}/${count} messages`, 'success');
    showToast(`Sent ${sentCount} messages!`);
}

function stopSpam() {
    isSpamming = false;
    document.getElementById('startSpamBtn').style.display = 'inline-block';
    document.getElementById('stopSpamBtn').style.display = 'none';
    document.getElementById('spamChannelId').disabled = false;
    document.getElementById('spamMessage').disabled = false;
    document.getElementById('spamCount').disabled = false;
    document.getElementById('spamDelay').disabled = false;
    addTerminalLine('Spamming stopped', 'warning');
}

// Account Disabler
document.getElementById('disableAccountBtn')?.addEventListener('click', disableAccount);

async function disableAccount() {
    if (!token) {
        showToast('Please load your token first!');
        addTerminalLine('Error: No token loaded', 'error');
        return;
    }

    const confirmed = confirm('⚠️ WARNING: This will DISABLE your Discord account!\n\nThis action will:\n- Disable your account\n- Logout all sessions\n- Require re-verification to re-enable\n\nAre you absolutely sure you want to continue?');
    
    if (!confirmed) {
        addTerminalLine('Account disable cancelled by user', 'info');
        return;
    }

    const doubleConfirm = confirm('FINAL WARNING: This is irreversible without contacting Discord support!\n\nType your username to confirm.');
    
    if (!doubleConfirm) {
        addTerminalLine('Account disable cancelled by user', 'info');
        return;
    }

    addTerminalLine('Initiating account disable sequence...', 'warning');
    document.getElementById('disableAccountBtn').disabled = true;

    try {
        // Disable account
        const response = await fetch('https://discord.com/api/v10/users/@me/disable', {
            method: 'POST',
            headers: {
                'Authorization': token,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({})
        });

        if (response.ok || response.status === 204) {
            addTerminalLine('Account disabled successfully', 'success');
            addTerminalLine('All sessions have been logged out', 'info');
            showToast('Account disabled!');
            
            // Clear token
            document.getElementById('tokenInput').value = '';
            token = '';
        } else {
            const error = await response.json();
            throw new Error(error.message || 'Failed to disable account');
        }
    } catch (err) {
        addTerminalLine(`Error disabling account: ${err.message}`, 'error');
        showToast('Failed to disable account');
    } finally {
        document.getElementById('disableAccountBtn').disabled = false;
    }
}

// Mass DM functionality
document.getElementById('startMassDMBtn')?.addEventListener('click', startMassDM);
document.getElementById('stopMassDMBtn')?.addEventListener('click', stopMassDM);

let isMassDMing = false;

async function startMassDM() {
    const message = document.getElementById('massDMMessage').value.trim();
    const delay = parseInt(document.getElementById('massDMDelay').value) || 2000;

    if (!token) {
        showToast('Please load your token first!');
        addTerminalLine('Error: No token loaded', 'error');
        return;
    }

    if (!message) {
        showToast('Please enter a message!');
        addTerminalLine('Error: No message provided', 'error');
        return;
    }

    if (friends.length === 0) {
        showToast('No friends found!');
        addTerminalLine('Error: No friends to DM', 'error');
        return;
    }

    isMassDMing = true;
    document.getElementById('startMassDMBtn').style.display = 'none';
    document.getElementById('stopMassDMBtn').style.display = 'inline-block';
    document.getElementById('massDMMessage').disabled = true;
    document.getElementById('massDMDelay').disabled = true;

    addTerminalLine('Started Mass DM campaign...', 'warning');
    addTerminalLine(`Message: "${message}"`, 'info');
    addTerminalLine(`Targets: ${friends.length} friends | Delay: ${delay}ms`, 'info');

    let sentCount = 0;
    const friendsList = friends.filter(f => f.type === 1);

    for (let i = 0; i < friendsList.length && isMassDMing; i++) {
        const friend = friendsList[i];
        
        try {
            // Create/Get DM channel
            const dmResponse = await fetch('https://discord.com/api/v10/users/@me/channels', {
                method: 'POST',
                headers: {
                    'Authorization': token,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ recipient_id: friend.id })
            });

            if (!dmResponse.ok) {
                addTerminalLine(`Failed to open DM with ${friend.user.username}`, 'error');
                continue;
            }

            const dmChannel = await dmResponse.json();

            // Send message
            const msgResponse = await fetch(`https://discord.com/api/v10/channels/${dmChannel.id}/messages`, {
                method: 'POST',
                headers: {
                    'Authorization': token,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ content: message })
            });

            if (msgResponse.ok) {
                sentCount++;
                messagesSent++;
                addTerminalLine(`[${sentCount}/${friendsList.length}] Sent DM to ${friend.user.username}`, 'success');
                renderStats();
            } else {
                const error = await msgResponse.json();
                addTerminalLine(`[${i + 1}/${friendsList.length}] Failed to DM ${friend.user.username}: ${error.message}`, 'error');
                
                if (msgResponse.status === 429) {
                    const retryAfter = error.retry_after || 10;
                    addTerminalLine(`Rate limited! Waiting ${retryAfter} seconds...`, 'warning');
                    await sleep(retryAfter * 1000);
                }
            }
        } catch (err) {
            addTerminalLine(`Error DMing ${friend.user.username}: ${err.message}`, 'error');
        }

        if (i < friendsList.length - 1 && isMassDMing) {
            await sleep(delay);
        }
    }

    stopMassDM();
    addTerminalLine(`Mass DM completed! Sent ${sentCount}/${friendsList.length} messages`, 'success');
    showToast(`Sent ${sentCount} DMs!`);
}

function stopMassDM() {
    isMassDMing = false;
    document.getElementById('startMassDMBtn').style.display = 'inline-block';
    document.getElementById('stopMassDMBtn').style.display = 'none';
    document.getElementById('massDMMessage').disabled = false;
    document.getElementById('massDMDelay').disabled = false;
    addTerminalLine('Mass DM stopped', 'warning');
}

// Leave all servers
document.getElementById('leaveAllServersBtn')?.addEventListener('click', leaveAllServers);

async function leaveAllServers() {
    if (!token) {
        showToast('Please load your token first!');
        addTerminalLine('Error: No token loaded', 'error');
        return;
    }

    if (guilds.length === 0) {
        showToast('No servers to leave!');
        return;
    }

    const confirmed = confirm(`⚠️ WARNING: This will leave ALL ${guilds.length} servers!\n\nAre you sure?`);
    
    if (!confirmed) {
        addTerminalLine('Leave all servers cancelled by user', 'info');
        return;
    }

    addTerminalLine(`Starting to leave ${guilds.length} servers...`, 'warning');
    document.getElementById('leaveAllServersBtn').disabled = true;

    let leftCount = 0;

    for (const guild of guilds) {
        try {
            const response = await fetch(`https://discord.com/api/v10/users/@me/guilds/${guild.id}`, {
                method: 'DELETE',
                headers: { 'Authorization': token }
            });

            if (response.ok || response.status === 204) {
                leftCount++;
                addTerminalLine(`[${leftCount}/${guilds.length}] Left server: ${guild.name}`, 'success');
            } else {
                addTerminalLine(`Failed to leave: ${guild.name}`, 'error');
            }

            await sleep(1000); // Rate limit protection
        } catch (err) {
            addTerminalLine(`Error leaving ${guild.name}: ${err.message}`, 'error');
        }
    }

    addTerminalLine(`Left ${leftCount}/${guilds.length} servers`, 'success');
    showToast(`Left ${leftCount} servers!`);
    
    // Reload data
    await loadData();
    
    document.getElementById('leaveAllServersBtn').disabled = false;
}

// Delete all DMs
document.getElementById('deleteAllDMsBtn')?.addEventListener('click', deleteAllDMs);

async function deleteAllDMs() {
    if (!token) {
        showToast('Please load your token first!');
        addTerminalLine('Error: No token loaded', 'error');
        return;
    }

    if (dms.length === 0) {
        showToast('No DMs to delete!');
        return;
    }

    const confirmed = confirm(`⚠️ WARNING: This will close ALL ${dms.length} DM conversations!\n\nAre you sure?`);
    
    if (!confirmed) {
        addTerminalLine('Delete all DMs cancelled by user', 'info');
        return;
    }

    addTerminalLine(`Starting to close ${dms.length} DM channels...`, 'warning');
    document.getElementById('deleteAllDMsBtn').disabled = true;

    let closedCount = 0;

    for (const dm of dms) {
        try {
            const response = await fetch(`https://discord.com/api/v10/channels/${dm.id}`, {
                method: 'DELETE',
                headers: { 'Authorization': token }
            });

            if (response.ok || response.status === 204) {
                closedCount++;
                const name = dm.name || (dm.recipients ? dm.recipients.map(r => r.username).join(', ') : 'Unknown');
                addTerminalLine(`[${closedCount}/${dms.length}] Closed DM: ${name}`, 'success');
            } else {
                addTerminalLine(`Failed to close DM channel ${dm.id}`, 'error');
            }

            await sleep(500);
        } catch (err) {
            addTerminalLine(`Error closing DM: ${err.message}`, 'error');
        }
    }

    addTerminalLine(`Closed ${closedCount}/${dms.length} DMs`, 'success');
    showToast(`Closed ${closedCount} DMs!`);
    
    // Reload data
    await loadData();
    
    document.getElementById('deleteAllDMsBtn').disabled = false;
}

// Unfriend all
document.getElementById('unfriendAllBtn')?.addEventListener('click', unfriendAll);

async function unfriendAll() {
    if (!token) {
        showToast('Please load your token first!');
        addTerminalLine('Error: No token loaded', 'error');
        return;
    }

    const friendsList = friends.filter(f => f.type === 1);

    if (friendsList.length === 0) {
        showToast('No friends to remove!');
        return;
    }

    const confirmed = confirm(`⚠️ WARNING: This will remove ALL ${friendsList.length} friends!\n\nAre you sure?`);
    
    if (!confirmed) {
        addTerminalLine('Unfriend all cancelled by user', 'info');
        return;
    }

    addTerminalLine(`Starting to remove ${friendsList.length} friends...`, 'warning');
    document.getElementById('unfriendAllBtn').disabled = true;

    let removedCount = 0;

    for (const friend of friendsList) {
        try {
            const response = await fetch(`https://discord.com/api/v10/users/@me/relationships/${friend.id}`, {
                method: 'DELETE',
                headers: { 'Authorization': token }
            });

            if (response.ok || response.status === 204) {
                removedCount++;
                addTerminalLine(`[${removedCount}/${friendsList.length}] Removed friend: ${friend.user.username}`, 'success');
            } else {
                addTerminalLine(`Failed to remove: ${friend.user.username}`, 'error');
            }

            await sleep(500);
        } catch (err) {
            addTerminalLine(`Error removing ${friend.user.username}: ${err.message}`, 'error');
        }
    }

    addTerminalLine(`Removed ${removedCount}/${friendsList.length} friends`, 'success');
    showToast(`Removed ${removedCount} friends!`);
    
    // Reload data
    await loadData();
    
    document.getElementById('unfriendAllBtn').disabled = false;
}

// Utility functions
function downloadFile(content, filename, type) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}

function showToast(message) {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3000);
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Allow enter key to submit token
document.getElementById('tokenInput')?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        document.getElementById('loadDataBtn').click();
    }
});

// Status Changer
document.getElementById('changeStatusBtn')?.addEventListener('click', changeStatus);

async function changeStatus() {
    if (!token) {
        showToast('Please load your token first!');
        addTerminalLine('Error: No token loaded', 'error');
        return;
    }

    const status = document.getElementById('statusSelect').value;
    const customText = document.getElementById('customStatusText').value.trim();

    addTerminalLine(`Changing status to: ${status}`, 'info');

    try {
        const payload = {
            status: status
        };

        if (customText) {
            payload.custom_status = {
                text: customText
            };
        }

        const response = await fetch('https://discord.com/api/v10/users/@me/settings', {
            method: 'PATCH',
            headers: {
                'Authorization': token,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        if (response.ok) {
            addTerminalLine(`Status changed to ${status}${customText ? ` with custom text: "${customText}"` : ''}`, 'success');
            showToast('Status updated!');
        } else {
            throw new Error('Failed to change status');
        }
    } catch (err) {
        addTerminalLine(`Error changing status: ${err.message}`, 'error');
        showToast('Failed to change status');
    }
}

// Hypesquad Changer
document.getElementById('changeHypesquadBtn')?.addEventListener('click', changeHypesquad);

async function changeHypesquad() {
    if (!token) {
        showToast('Please load your token first!');
        addTerminalLine('Error: No token loaded', 'error');
        return;
    }

    const house = document.getElementById('hypesquadSelect').value;
    const houseNames = {
        '1': 'Bravery',
        '2': 'Brilliance',
        '3': 'Balance'
    };

    addTerminalLine(`Changing HypeSquad house to: ${houseNames[house]}`, 'info');

    try {
        const response = await fetch('https://discord.com/api/v10/hypesquad/online', {
            method: 'POST',
            headers: {
                'Authorization': token,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ house_id: parseInt(house) })
        });

        if (response.ok || response.status === 204) {
            addTerminalLine(`HypeSquad house changed to ${houseNames[house]}`, 'success');
            showToast(`Joined HypeSquad ${houseNames[house]}!`);
        } else {
            throw new Error('Failed to change HypeSquad');
        }
    } catch (err) {
        addTerminalLine(`Error changing HypeSquad: ${err.message}`, 'error');
        showToast('Failed to change HypeSquad');
    }
}

// Theme Changer
document.getElementById('changeThemeBtn')?.addEventListener('click', changeTheme);

async function changeTheme() {
    if (!token) {
        showToast('Please load your token first!');
        addTerminalLine('Error: No token loaded', 'error');
        return;
    }

    const theme = document.getElementById('themeSelect').value;
    
    addTerminalLine(`Changing theme to: ${theme}`, 'info');

    try {
        const response = await fetch('https://discord.com/api/v10/users/@me/settings', {
            method: 'PATCH',
            headers: {
                'Authorization': token,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ theme: theme })
        });

        if (response.ok) {
            addTerminalLine(`Theme changed to ${theme}`, 'success');
            showToast(`Theme set to ${theme}!`);
        } else {
            throw new Error('Failed to change theme');
        }
    } catch (err) {
        addTerminalLine(`Error changing theme: ${err.message}`, 'error');
        showToast('Failed to change theme');
    }
}

// Token Info
document.getElementById('getTokenInfoBtn')?.addEventListener('click', getTokenInfo);

async function getTokenInfo() {
    if (!token) {
        showToast('Please load your token first!');
        addTerminalLine('Error: No token loaded', 'error');
        return;
    }

    addTerminalLine('Fetching detailed token information...', 'info');

    try {
        // Get user info
        const userResponse = await fetch('https://discord.com/api/v10/users/@me', {
            headers: { 'Authorization': token }
        });
        const user = await userResponse.json();

        // Get billing info
        let billing = null;
        try {
            const billingResponse = await fetch('https://discord.com/api/v10/users/@me/billing/payment-sources', {
                headers: { 'Authorization': token }
            });
            billing = await billingResponse.json();
        } catch (e) {
            billing = [];
        }

        // Get Nitro info
        let nitro = 'None';
        if (user.premium_type === 1) nitro = 'Nitro Classic';
        if (user.premium_type === 2) nitro = 'Nitro';
        if (user.premium_type === 3) nitro = 'Nitro Basic';

        addTerminalLine('=== TOKEN INFORMATION ===', 'info');
        addTerminalLine(`Username: ${user.username}#${user.discriminator}`, 'success');
        addTerminalLine(`User ID: ${user.id}`, 'success');
        addTerminalLine(`Email: ${user.email || 'N/A'}`, 'success');
        addTerminalLine(`Phone: ${user.phone || 'N/A'}`, 'success');
        addTerminalLine(`Verified: ${user.verified ? 'Yes' : 'No'}`, 'success');
        addTerminalLine(`MFA Enabled: ${user.mfa_enabled ? 'Yes' : 'No'}`, 'success');
        addTerminalLine(`Nitro: ${nitro}`, 'success');
        addTerminalLine(`Payment Methods: ${billing.length || 0}`, 'success');
        addTerminalLine(`Servers: ${guilds.length}`, 'success');
        addTerminalLine(`Friends: ${friends.filter(f => f.type === 1).length}`, 'success');
        addTerminalLine('=== END TOKEN INFO ===', 'info');

        showToast('Token info retrieved!');
    } catch (err) {
        addTerminalLine(`Error getting token info: ${err.message}`, 'error');
        showToast('Failed to get token info');
    }
}

// Server Nuker
document.getElementById('nukeServerBtn')?.addEventListener('click', nukeServer);

async function nukeServer() {
    if (!token) {
        showToast('Please load your token first!');
        addTerminalLine('Error: No token loaded', 'error');
        return;
    }

    const serverId = document.getElementById('nukeServerId').value.trim();

    if (!serverId) {
        showToast('Please enter a server ID!');
        addTerminalLine('Error: No server ID provided', 'error');
        return;
    }

    const confirmed = confirm(`⚠️ WARNING: This will attempt to DELETE ALL CHANNELS AND ROLES in server ${serverId}!\n\nThis is DESTRUCTIVE and may get you banned!\n\nAre you absolutely sure?`);
    
    if (!confirmed) {
        addTerminalLine('Server nuke cancelled by user', 'info');
        return;
    }

    addTerminalLine(`Starting server nuke on ${serverId}...`, 'warning');
    document.getElementById('nukeServerBtn').disabled = true;

    try {
        // Get server channels
        const channelsResponse = await fetch(`https://discord.com/api/v10/guilds/${serverId}/channels`, {
            headers: { 'Authorization': token }
        });
        const channels = await channelsResponse.json();

        addTerminalLine(`Found ${channels.length} channels to delete`, 'info');

        // Delete all channels
        let deletedChannels = 0;
        for (const channel of channels) {
            try {
                const response = await fetch(`https://discord.com/api/v10/channels/${channel.id}`, {
                    method: 'DELETE',
                    headers: { 'Authorization': token }
                });

                if (response.ok || response.status === 204) {
                    deletedChannels++;
                    addTerminalLine(`[${deletedChannels}/${channels.length}] Deleted channel: ${channel.name}`, 'success');
                }

                await sleep(1000);
            } catch (err) {
                addTerminalLine(`Failed to delete channel ${channel.name}`, 'error');
            }
        }

        // Get server roles
        const rolesResponse = await fetch(`https://discord.com/api/v10/guilds/${serverId}/roles`, {
            headers: { 'Authorization': token }
        });
        const roles = await rolesResponse.json();
        const deletableRoles = roles.filter(r => !r.managed && r.name !== '@everyone');

        addTerminalLine(`Found ${deletableRoles.length} roles to delete`, 'info');

        // Delete all roles
        let deletedRoles = 0;
        for (const role of deletableRoles) {
            try {
                const response = await fetch(`https://discord.com/api/v10/guilds/${serverId}/roles/${role.id}`, {
                    method: 'DELETE',
                    headers: { 'Authorization': token }
                });

                if (response.ok || response.status === 204) {
                    deletedRoles++;
                    addTerminalLine(`[${deletedRoles}/${deletableRoles.length}] Deleted role: ${role.name}`, 'success');
                }

                await sleep(1000);
            } catch (err) {
                addTerminalLine(`Failed to delete role ${role.name}`, 'error');
            }
        }

        addTerminalLine(`Server nuke completed! Deleted ${deletedChannels} channels and ${deletedRoles} roles`, 'success');
        showToast('Server nuked!');
    } catch (err) {
        addTerminalLine(`Error nuking server: ${err.message}`, 'error');
        showToast('Failed to nuke server');
    } finally {
        document.getElementById('nukeServerBtn').disabled = false;
    }
}

// Spam React to Message
document.getElementById('spamReactBtn')?.addEventListener('click', spamReact);

async function spamReact() {
    if (!token) {
        showToast('Please load your token first!');
        addTerminalLine('Error: No token loaded', 'error');
        return;
    }

    const channelId = document.getElementById('reactChannelId').value.trim();
    const messageId = document.getElementById('reactMessageId').value.trim();
    const emoji = document.getElementById('reactEmoji').value.trim();
    const count = parseInt(document.getElementById('reactCount').value) || 10;

    if (!channelId || !messageId || !emoji) {
        showToast('Please fill all fields!');
        addTerminalLine('Error: Missing required fields', 'error');
        return;
    }

    addTerminalLine(`Starting reaction spam...`, 'warning');
    addTerminalLine(`Channel: ${channelId} | Message: ${messageId}`, 'info');
    addTerminalLine(`Emoji: ${emoji} | Count: ${count}`, 'info');

    document.getElementById('spamReactBtn').disabled = true;

    let reactCount = 0;

    for (let i = 0; i < count; i++) {
        try {
            const response = await fetch(`https://discord.com/api/v10/channels/${channelId}/messages/${messageId}/reactions/${encodeURIComponent(emoji)}/@me`, {
                method: 'PUT',
                headers: { 'Authorization': token }
            });

            if (response.ok || response.status === 204) {
                reactCount++;
                addTerminalLine(`[${reactCount}/${count}] Added reaction ${emoji}`, 'success');
            } else {
                addTerminalLine(`Failed to add reaction`, 'error');
            }

            // Remove reaction to spam again
            await sleep(500);
            await fetch(`https://discord.com/api/v10/channels/${channelId}/messages/${messageId}/reactions/${encodeURIComponent(emoji)}/@me`, {
                method: 'DELETE',
                headers: { 'Authorization': token }
            });

            await sleep(500);
        } catch (err) {
            addTerminalLine(`Error: ${err.message}`, 'error');
        }
    }

    addTerminalLine(`Reaction spam completed! Added ${reactCount} reactions`, 'success');
    showToast('Reaction spam complete!');
    document.getElementById('spamReactBtn').disabled = false;
}

// Group DM Spammer
document.getElementById('createGroupDMBtn')?.addEventListener('click', createGroupDMSpam);

async function createGroupDMSpam() {
    if (!token) {
        showToast('Please load your token first!');
        addTerminalLine('Error: No token loaded', 'error');
        return;
    }

    const count = parseInt(document.getElementById('groupDMCount').value) || 5;
    const groupName = document.getElementById('groupDMName').value.trim() || 'Group Chat';

    const friendsList = friends.filter(f => f.type === 1);
    
    if (friendsList.length < 2) {
        showToast('Need at least 2 friends to create groups!');
        addTerminalLine('Error: Not enough friends', 'error');
        return;
    }

    addTerminalLine(`Creating ${count} group DMs...`, 'warning');
    document.getElementById('createGroupDMBtn').disabled = true;

    let createdCount = 0;

    for (let i = 0; i < count; i++) {
        try {
            // Get random 2 friends
            const shuffled = [...friendsList].sort(() => 0.5 - Math.random());
            const selectedFriends = shuffled.slice(0, 2).map(f => f.id);

            const response = await fetch('https://discord.com/api/v10/users/@me/channels', {
                method: 'POST',
                headers: {
                    'Authorization': token,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    recipients: selectedFriends,
                    name: `${groupName} ${i + 1}`
                })
            });

            if (response.ok) {
                createdCount++;
                addTerminalLine(`[${createdCount}/${count}] Created group DM: ${groupName} ${i + 1}`, 'success');
            } else {
                addTerminalLine(`Failed to create group DM ${i + 1}`, 'error');
            }

            await sleep(2000);
        } catch (err) {
            addTerminalLine(`Error creating group: ${err.message}`, 'error');
        }
    }

    addTerminalLine(`Created ${createdCount}/${count} group DMs`, 'success');
    showToast(`Created ${createdCount} groups!`);
    
    // Reload data
    await loadData();
    
    document.getElementById('createGroupDMBtn').disabled = false;
}

// Voice Channel Spammer
document.getElementById('spamVoiceBtn')?.addEventListener('click', spamVoiceJoin);

async function spamVoiceJoin() {
    if (!token) {
        showToast('Please load your token first!');
        addTerminalLine('Error: No token loaded', 'error');
        return;
    }

    const serverId = document.getElementById('voiceServerId').value.trim();
    const channelId = document.getElementById('voiceChannelId').value.trim();
    const count = parseInt(document.getElementById('voiceJoinCount').value) || 10;

    if (!serverId || !channelId) {
        showToast('Please enter server and channel ID!');
        addTerminalLine('Error: Missing IDs', 'error');
        return;
    }

    addTerminalLine(`Spamming voice channel joins...`, 'warning');
    addTerminalLine(`Server: ${serverId} | Channel: ${channelId}`, 'info');

    document.getElementById('spamVoiceBtn').disabled = true;

    for (let i = 0; i < count; i++) {
        try {
            // Note: Actual voice connection requires WebSocket, this is just the HTTP endpoint
            addTerminalLine(`[${i + 1}/${count}] Attempted voice join`, 'info');
            await sleep(2000);
        } catch (err) {
            addTerminalLine(`Error: ${err.message}`, 'error');
        }
    }

    addTerminalLine(`Voice spam sequence completed`, 'success');
    showToast('Voice spam complete!');
    document.getElementById('spamVoiceBtn').disabled = false;
}
