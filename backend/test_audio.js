async function test() {
    const lovableDomain = 'https://ecodevsil.lovable.app';
    const bridgeSecret = 'PawandaBridge2026!';

    const mediaUrl = 'https://bmn8ocxpqcwj.compat.objectstorage.ap-mumbai-1.oraclecloud.com/devsil-ems-product-listing/prod_file_1791318038460_n1av54.ogg';

    const payload = {
        to: '+923145607065', 
        type: 'audio',
        url: mediaUrl,
        voice: true // The undocumented (for Lovable) flag we want to test
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
