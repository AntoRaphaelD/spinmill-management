export const getNextInvoiceSequence = (history, prefix, currentPartyName = '') => {
    if (prefix === 'DM-' || prefix === 'DI-' || prefix === 'ME-') {
        const maxNo = history.reduce((max, item) => {
            const invNo = String(item.invoice_no || '').trim();
            if (invNo.startsWith(prefix)) {
                const cleanNo = invNo.substring(prefix.length);
                const numVal = parseInt(cleanNo, 10);
                return Math.max(max, isNaN(numVal) ? 0 : numVal);
            }
            return max;
        }, 0);
        return maxNo + 1;
    }

    // Normal Sequence
    const sortedNormalHistory = [...history]
        .filter(item => {
            const invNo = String(item.invoice_no || '').trim();
            return !invNo.startsWith('DM-') && !invNo.startsWith('DI-') && !invNo.startsWith('ME-');
        })
        .sort((a, b) => {
            const dateA = new Date(a.date || 0).getTime();
            const dateB = new Date(b.date || 0).getTime();
            if (dateA !== dateB) return dateA - dateB;
            return (a.id || 0) - (b.id || 0);
        });

    let normalCounter = 0;
    let lastWasYarnTesting = false;
    let lastYarnTestingInvoiceNo = '';

    for (const inv of sortedNormalHistory) {
        const partyName = String(inv.Party?.account_name || inv.party_name || '').toUpperCase().trim();
        const isYarnTesting = partyName.includes('YARN TESTING');
        let newInvNo = '';
        if (isYarnTesting && lastWasYarnTesting) {
            newInvNo = lastYarnTestingInvoiceNo;
        } else {
            normalCounter++;
            newInvNo = String(normalCounter);
            if (isYarnTesting) {
                lastYarnTestingInvoiceNo = newInvNo;
            }
        }
        lastWasYarnTesting = isYarnTesting;
    }

    const currentPartyUpper = String(currentPartyName || '').toUpperCase().trim();
    if (currentPartyUpper.includes('YARN TESTING')) {
        if (lastWasYarnTesting) {
            return lastYarnTestingInvoiceNo || String(normalCounter + 1);
        } else {
            return String(normalCounter + 1);
        }
    } else {
        return String(normalCounter + 1);
    }
};

export const getPrefixForParty = (partyName, salesType = '') => {
    const sType = String(salesType || '').toUpperCase().trim();
    if (sType === 'MERCHANT SALES') {
        return 'ME-';
    }
    const name = String(partyName || '').toUpperCase().trim();
    if (name === 'DEPOT - MUMBAI') {
        return 'DM-';
    } else if (name.includes('KAYAAR EXPORTS PRIVATE LIMITED')) {
        return 'DI-';
    }
    return '';
};

export const getNextDepotInvoiceSequence = (history, depotName, partyName) => {
    const currentDepot = String(depotName || '').toUpperCase().trim();
    const currentParty = String(partyName || '').toUpperCase().trim();

    const isCurrentMumbai = currentDepot.includes('DEPOT - MUMBAI') || currentDepot.includes('DEPOT MUMBAI') || currentParty.includes('DEPOT - MUMBAI') || currentParty.includes('DEPOT MUMBAI');
    const isCurrentKayaar = currentDepot.includes('KAYAAR EXPORTS') || currentParty.includes('KAYAAR EXPORTS');

    const maxNo = history.reduce((max, item) => {
        const invNo = String(item.invoice_no || '').trim();
        const cleanNo = invNo.replace(/\D/g, '');
        const numVal = parseInt(cleanNo, 10);
        if (isNaN(numVal)) return max;

        const itemDepot = String(item.Depot?.account_name || '').toUpperCase().trim();
        const itemParty = String(item.Party?.account_name || '').toUpperCase().trim();

        const itemIsMumbai = itemDepot.includes('DEPOT - MUMBAI') || itemDepot.includes('DEPOT MUMBAI') || itemParty.includes('DEPOT - MUMBAI') || itemParty.includes('DEPOT MUMBAI');
        const itemIsKayaar = itemDepot.includes('KAYAAR EXPORTS') || itemParty.includes('KAYAAR EXPORTS');

        if (isCurrentMumbai) {
            if (itemIsMumbai) {
                return Math.max(max, numVal);
            }
        } else if (isCurrentKayaar) {
            if (itemIsKayaar) {
                return Math.max(max, numVal);
            }
        } else {
            if (!itemIsMumbai && !itemIsKayaar) {
                return Math.max(max, numVal);
            }
        }
        return max;
    }, 0);

    return maxNo + 1;
};

