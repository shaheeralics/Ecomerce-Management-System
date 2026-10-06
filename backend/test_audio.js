async function test() {
    const lovableDomain = 'https://ecodevsil.lovable.app';
    const bridgeSecret = 'PawandaBridge2026!';

    const mediaUrl = 'https://bmn8ocxpqcwj.compat.objectstorage.ap-mumbai-1.oraclecloud.com/devsil-ems-product-listing/prod_file_1791316701471_ckw9gh.mp3';

    const payload = {
        to: '+923145607065', 
        type: 'audio',
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
