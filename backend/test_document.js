async function test() {
    const lovableDomain = 'https://ecodevsil.lovable.app';
    const bridgeSecret = 'PawandaBridge2026!';

    // Fake URL that exists on the web (sample webm)
    // using a webm url from somewhere
    const mediaUrl = 'https://upload.wikimedia.org/wikipedia/commons/4/4b/Apple_pie.webm';

    const payload = {
        to: '+923145607065', 
        type: 'document',
        url: mediaUrl
    };

    const response = await fetch(`${lovableDomain}/api/public/whatsapp/send`, {
        method: 'POST',
        headers: {
            'X-Bridge-Secret': bridgeSecret,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
    });
    
    const data = await response.json();
    console.log(response.status, data);
}

test();
