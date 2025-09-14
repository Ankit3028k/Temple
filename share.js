async function shareOrDownloadPdf(url, filename) {
    try {
        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });
        if (!response.ok) {
            throw new Error('Failed to download PDF');
        }
        const blob = await response.blob();
        if (navigator.share && navigator.canShare({ files: [new File([blob], filename, { type: 'application/pdf' })] })) {
            await navigator.share({
                files: [new File([blob], filename, { type: 'application/pdf' })],
                title: 'Receipt',
                text: 'Here is your receipt.',
            });
        } else {
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
    } catch (error) {
        console.error('Error sharing or downloading PDF:', error);
        alert('Failed to share or download PDF: ' + error.message);
    }
}