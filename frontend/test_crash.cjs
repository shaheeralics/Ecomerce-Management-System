const puppeteer = require('puppeteer');

(async () => {
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    
    page.on('console', msg => console.log('PAGE LOG:', msg.text()));
    page.on('pageerror', error => console.log('PAGE ERROR:', error.message));
    
    await page.goto('http://localhost:5173/');
    
    // Wait for render
    await new Promise(r => setTimeout(r, 2000));
    
    console.log('Clicking Chats tab...');
    // Assuming Chats tab has text "Chats" or we can find it
    const tabs = await page.$$('button, div');
    let clicked = false;
    for (const tab of tabs) {
        const text = await page.evaluate(el => el.textContent, tab);
        if (text && text.includes('Chats')) {
            await tab.click();
            clicked = true;
            break;
        }
    }
    
    if (!clicked) {
        console.log('Could not find Chats tab to click');
    }
    
    await new Promise(r => setTimeout(r, 2000));
    
    await browser.close();
})();
