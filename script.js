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
document.getElementById('startSpamBtn').addEventListener('click', startSpam);
document.getElementById('stopSpamBtn').addEventListener('click', stopSpam);

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
document.getElementById('tokenInput').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        document.getElementById('loadDataBtn').click();
    }
});
