const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const START_NUM = 73;
const END_NUM = 220;
const ISSUES_DIR = 'issues';

console.log(`🚀 Starting bulk issue creation for ISSUE${String(START_NUM).padStart(3, '0')} through ISSUE${END_NUM}...`);

async function run() {
    for (let i = START_NUM; i <= END_NUM; i++) {
        const num = String(i).padStart(3, '0');
        const filePath = path.join(ISSUES_DIR, `ISSUE${num}.md`);

        if (fs.existsSync(filePath)) {
            console.log(`----------------------------------------------------`);
            console.log(`📂 Processing ${filePath}...`);

            const content = fs.readFileSync(filePath, 'utf8');
            const lines = content.split('\n');

            const title = lines[0].trim();
            const body = lines.slice(1).join('\n').trim();

            try {
                // We use spawn-like behavior via a temporary file or pipe to handle large bodies
                // But for simplicity with gh CLI, we can pass the body via stdin
                const command = `gh issue create --title "${title.replace(/"/g, '\\"')}" --body-file -`;

                execSync(command, {
                    input: body,
                    stdio: ['pipe', 'inherit', 'inherit']
                });

                console.log(`✅ Successfully created ISSUE${num}`);
            } catch (error) {
                console.error(`❌ Failed to create ISSUE${num}:`, error.message);
                process.exit(1);
            }

            // 1 second delay to avoid rate limits
            await new Promise(resolve => setTimeout(resolve, 1000));
        } else {
            console.warn(`⚠️  File ${filePath} not found, skipping.`);
        }
    }

    console.log(`----------------------------------------------------`);
    console.log(`🎉 Done! All issues from ${START_NUM} to ${END_NUM} have been processed.`);
}

run();
