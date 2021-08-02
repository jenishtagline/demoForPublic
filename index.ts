const _ = LodashGS.load();
// import * as _ from 'lodash';
function generateClientTabFormula(clientName: string) {
    return `
  getClientAirchecks(
  QUERY(Airchecks!A:AX,"select * where F = '${clientName}' and AM = TRUE order by D", 1),
  QUERY('Radio Airchecks'!A:AD,"select * where C = '${clientName}' and V = TRUE order by B", 1),
  QUERY('Special Drop Off Request'!A:AM,"select * where A = '${clientName}' order by C", 1)
)`;
};

function generateClientTabs() {
    const ss: any = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('Airchecks');
    const last = sheet.getLastRow();

    for (var i = 1; i < last; i++) {
        const tabName = sheet.getRange(i + 6, 6).getValue();

        try {
            if (ss.getSheetByName(tabName) == null) {
                ss.insertSheet(tabName);
                ss.getSheetByName(tabName)
                    .getRange('A1')
                    .setFormula(generateClientTabFormula(tabName));
            }
        }
        catch (err) {
            Logger.log(err);

        }
    }
    Logger.log('===done===');
}
const colNameMap = {
    'Publish Date Week': 'Week Of',
    'Publish Date (PST)': 'Drop Date',
    Sponsor: 'Client',
    Podcast: 'Placement Name',
    'Ad Audio Link (Direct Download)': 'Audio Link',
    'Podcast Apple Id': 'Station Code',
    'Oxford Status (Auto)': 'Status',
    'Is this spot customized?': 'Is this spot customized? (INTERNAL)',
    'Is this spot a personal testimonial?': 'Is this spot a personal testimonial? (INTERNAL)',
    'Is this spot a personal recommendation?': 'Is this spot a personal recommendation? (INTERNAL)',
    'Type of Read': 'Type of Read (INTERNAL)',
    'Optimization / Collection Notes': 'Optimization Notes',
    'Media Type (AUTO)': 'Media Type'
};

function getClientAirchecks(podcastAdsFiltered: Array<any>, radioAdsFiltered: any, specialFiltered: any) {
    if (!Array.isArray(podcastAdsFiltered)) {
        return podcastAdsFiltered;
    }
    const mainHeaders = _.get(podcastAdsFiltered, '[0]');

    const headerstoRadioColIdx = _.fromPairs(
        _.map(mainHeaders, (colName: any) => [colName, _.indexOf(_.get(radioAdsFiltered, '[0]', []), _.get(colNameMap, colName, colName))])
    );
    const headerstoSpecialColIdx = _.fromPairs(
        _.map(mainHeaders, (colName: any) => [colName, _.indexOf(_.get(specialFiltered, '[0]', []), _.get(colNameMap, colName, colName))])
    );
    const colIdxsToRemove = _.map([
        'Download Date (PST)',
        'Ad Audio Link (Direct Download)',
        'Script Link',
        'Episode Link',
        'Transcript Link',
        'Podscribe Ad ID',
    ], (colName: any) => _.indexOf(mainHeaders, colName));

    return _.concat([mainHeaders], _.orderBy(_.concat(
        podcastAdsFiltered.slice(1),
        _.map(_.slice(radioAdsFiltered, 1), (row: any) => mainHeaders.map((colName: any) => _.get(row, `[${headerstoRadioColIdx[colName]}]`))),
        _.map(_.slice(specialFiltered, 1), (row: any) => mainHeaders.map((colName: any) => _.get(row, `[${headerstoSpecialColIdx[colName]}]`))),
    ), (r: any) => r[3])).map((row: any) => _.filter(row, (_v: any, idx: number) => !colIdxsToRemove.includes(idx)));
};

const secToDayFract = (secs: any) => {
    return typeof secs !== 'string' ? '' : parseInt(secs) / (60 * 60 * 24);
};

function smartMatchLengthToReqLengths(exactLength: number, reqLengths: any) {
    if (!reqLengths.includes(',')) {
        return reqLengths;
    }

    let closestMatch: any;

    // if (Math.round(exactLength) === 44) {
    // console.log(`sm, el==${exactLength}, rls=${reqLengths}`)
    // }

    reqLengths.split(',')
        .map((reqLength: any) => reqLength.includes(':') ? secToDayFract(reqLength.split(':')[1]) : null)
        .filter((rs: any) => rs != null)
        .forEach((length: number) => {
            if (!closestMatch || (Math.abs(length - exactLength) < Math.abs(closestMatch - exactLength))) {
                closestMatch = length;
            }
        });

    return closestMatch ? ':' + Math.round(closestMatch * 24 * 60 * 60) : '-';
};

function smarterAdLength(requestedAdLengths: any, exactAdLengths: any) {
    return !Array.isArray(requestedAdLengths)
        ? requestedAdLengths
        : requestedAdLengths.map(
            (row, idx) => row.map((cell: any) => smartMatchLengthToReqLengths(exactAdLengths[idx][0], cell))
        );
};

function parseLengths(lengthStr: string) {
    try {
        return lengthStr
            .trim()
            .replace(' /g', ',')
            .split(',')
            .map(str => _.get(str.split('-'), '[0]'))
            .filter(l => !!l)
            .map(str => parseInt(str));
    } catch (err) {
        Logger.log(err);
    }
};

const allowedUnits = ['pre', 'mid', 'post'];

function isExtra(showIdSponsorReqweek: any, pubDates: any, foundAdTypes: any, foundAdLengths: any, requests: any) {
    const requestCounts: any = {};
    _.filter(requests, (req: any) => !!req[6])
        .forEach((req: any) => {
            const key = req[0].toLowerCase();
            if (!requestCounts[key]) {
                requestCounts[key] = { pre: [], mid: [], post: [] };
            }

            (req[6] || '')
                .replace(/[\+ ]/g, ',')
                .split(',')
                .map((u: string) => (u || '').toLowerCase().trim())
                .filter((unit: string) => allowedUnits.includes(unit))
                .forEach((unit: string) => requestCounts[key][unit] = requestCounts[key][unit].concat(req[7])); // length
        });

    const foundLengthsByKey: any = {};
    const withPubDatesSorted = showIdSponsorReqweek
        .map((k: any, origIdx: number) => ({
            key: k[0].toLowerCase(),
            pubDate: new Date(pubDates[origIdx][0]).getTime(),
            foundLength: foundAdLengths[origIdx][0] * 24 * 60 * 60,
            foundUnit: (foundAdTypes[origIdx][0] || '').toLowerCase(),
            origIdx
        })).sort((a: any, b: any) => a.pubDate - b.pubDate)
        .map(({ key, origIdx, foundLength, foundUnit, ...rest }: any) => {
            if (!foundLengthsByKey[key]) {
                foundLengthsByKey[key] = { pre: [], mid: [], post: [] };
            }
            foundLengthsByKey[key][foundUnit] = _.concat(foundLengthsByKey[key][foundUnit], ({ foundLength, origIdx }));

            return { key, origIdx, foundLength, foundUnit, ...rest };
        });

    const foundUnitsToStatus = (foundUnits: any, requestedUnits: string) => {
        const origIdxsToStatus: any = {};
        const allFound = _.flatten(_.values(
            _.mapValues(
                foundUnits,
                (lengths: any, unit: any) => !allowedUnits.includes(unit)
                    ? lengths
                    : _.map(lengths, ({ foundLength, origIdx }: any) => ({ origIdx, length: foundLength, unit }))
            )
        )
        );
        const reqLengths = _.first(_.values(requestedUnits).filter((ls: any) => ls.length > 0));

        const getShortStr = (foundLength: any, reqLengths: any) => {
            const match = smartMatchLengthToReqLengths(foundLength / (24 * 60 * 60), reqLengths.join(','));
            const isShort = match.split(':').length > 1 ? parseInt(match.split(':')[1]) > (foundLength + 2) : false;
            return isShort ? ' (SHORT)' : '';
        };

        let otherAdsToAssign: any = [];

        allowedUnits.map(unit => {
            const numFoundForUnit = _.filter(allFound, { unit }).length;
            const numRequestedForUnit = _.get(requestedUnits, `${unit}.length`, 0);
            const adsFoundForUnit = _.filter(allFound, { unit });

            if (numFoundForUnit <= numRequestedForUnit) {
                return adsFoundForUnit.forEach(({ origIdx, length }: any) => origIdxsToStatus[origIdx] = { status: 'MATCH' + getShortStr(length, reqLengths), unit });
            }

            // there are EXTRAs or MISMATCHES for this unit
            const numOverForUnit = Math.max(numFoundForUnit - numRequestedForUnit, 0);
            _.take(_.sortBy(adsFoundForUnit, ['length', 'origIdx']).reverse(), numRequestedForUnit)
                .forEach(({ origIdx, length }: any) => origIdxsToStatus[origIdx] = { status: 'MATCH' + getShortStr(length, reqLengths), unit });

            otherAdsToAssign = _.concat(otherAdsToAssign, _.take(_.sortBy(adsFoundForUnit, ['length', 'origIdx']), numOverForUnit));
        });

        _.forEach(otherAdsToAssign, ({ origIdx, unit, length }: any) => {
            if (_.get(requestedUnits, 'pre.length', 0) - _.values(origIdxsToStatus).length > 0) {
                return origIdxsToStatus[origIdx] = { status: 'MATCH (MISMATCH)' + getShortStr(length, reqLengths), unit: 'pre' };
            }
            if (_.get(requestedUnits, 'mid.length', 0) - _.values(origIdxsToStatus).length > 0) {
                return origIdxsToStatus[origIdx] = { status: 'MATCH (MISMATCH)' + getShortStr(length, reqLengths), unit: 'mid' };
            }
            if (_.get(requestedUnits, 'post.length', 0) - _.values(origIdxsToStatus).length > 0) {
                return origIdxsToStatus[origIdx] = { status: 'MATCH (MISMATCH)' + getShortStr(length, reqLengths), unit: 'mid' };
            }
            return origIdxsToStatus[origIdx] = {
                status: `EXTRA ${_.filter(allFound, { unit }).length}/${_.get(requestedUnits, `${unit}.length`, 0)}`,
                unit
            };
        });

        return origIdxsToStatus;
    };

    return _.sortBy(withPubDatesSorted, 'origIdx').map(
        ({ key, origIdx }: any) => _.get(foundUnitsToStatus(foundLengthsByKey[key], requestCounts[key]), `[${origIdx}].status`)
    );
};

const reconHeaders = [
    'Week Of (Booked Date)',
    'Week Of (Drop Date)',
    'Est #',
    'Client',
    'Publisher',
    'Placement Name',
    'Category',
    'Paid Ad Unit',
    'Found Ad Unit',
    'Paid Ad Length',
    'Found Ad Length',
    'Booked Date (in Strata)',
    'Actual Drop Date',
    'Podscribe Status'
];

function getRecon(requests: any, ads: any) {
    const adLookup: any = {};
    let i = 0;

    _.forEach(ads, (ad: any) => {
        adLookup[ad[0].toLowerCase()] = _.concat(_.get(adLookup, ad[0].toLowerCase(), []), [ad]).sort((a: any, b: any) => a[2] - b[2]);
    });

    const formatStatus = (ad: any) => {
        if (ad.length === 0) {
            return 'MISSING';
        };
        return _.get(ad, '[3]', '');

        // const podStatus = _.get(ad, '[3]', '').split(' ')[0];
        // switch (podStatus) {
        //   case 'EXTRA': return 'EXTRA';
        //   case 'MATCH': return 'MATCH';
        //   default: return `MATCH (${podStatus})`
        // }
    };

    const allMatchedAds = new Set();

    const res = _.flatMap(_.filter(requests.slice(1), (r: any) => !!r[0]), (req: any) => {
        // only take 1 match, or extras
        const adsMatchingReq = new Set();
        const adsToMatch = _.get(adLookup, req[0].toLowerCase(), [[]]).filter((a: any) => !allMatchedAds.has(a[7]));

        // match all extra
        adsToMatch
            .filter((a: any) => _.get(a, '[3]', '').includes('EXTRA'))
            .map((a: any) => {
                allMatchedAds.add(a[7]);
                adsMatchingReq.add(a);
            });

        // take one MATCH
        _.slice(adsToMatch.filter((a: any) => _.get(a, '[3]', '').includes('MATCH')), 0, 1).map((a: any) => {
            allMatchedAds.add(a[7]);
            adsMatchingReq.add(a);
        });

        return _.map(Array.from(adsMatchingReq).length > 0 ? Array.from(adsMatchingReq) : [[]], (ad: any) => [
            req[12],
            _.get(ad, '[1]', ''),
            req[8],
            req[4],
            req[5],
            req[2],
            req[9],
            req[6], // paid ad unit
            _.get(ad, '[4]', '').slice(0, 1) + _.get(ad, '[4]', '').slice(1).toLowerCase(), // found ad unit
            // secToDayFract(_.get(req, '[7]', '').split(":")[1]), // paid ad length
            smartMatchLengthToReqLengths(_.get(ad, '[6]', 0) * 24 * 60 * 60, req[7]),
            _.get(ad, '[6]', ''), // found ad length
            req[3], // booked date
            _.get(ad, '[2]', ''), // actual drop date
            formatStatus(ad)
        ]);
    });

    return _.concat([reconHeaders], res);
};

function isExtraAF(showIdSponsorReqweek: any, pubDates: any, foundAdTypes: any, foundAdLengths: any, requests: any, expectedWks: any, foundWks: any) {
    // console.log("show id req wk===", showIdSponsorReqweek);

    const requestCounts: any = {};
    _.filter(requests, (req: any) => !!req[6])
        .forEach((req: any) => {
            const key = req[0].toLowerCase();
            if (!requestCounts[key]) {
                requestCounts[key] = { pre: [], mid: [], post: [] };
            }

            (req[6] || '')
                .replace(/[\+ ]/g, ',')
                .split(',')
                .map((u: any) => (u || '').toLowerCase().trim())
                .filter((unit: any) => allowedUnits.includes(unit))
                .forEach((unit: any) => requestCounts[key][unit] = requestCounts[key][unit].concat(req[7])); // length
        });

    const foundLengthsByKey: any = {};
    const withPubDatesSorted = showIdSponsorReqweek
        .map((k: any, origIdx: number) => ({
            key: k[0].toLowerCase(),
            pubDate: new Date(pubDates[origIdx][0]).getTime(),
            foundLength: foundAdLengths[origIdx][0] * 24 * 60 * 60,
            foundUnit: (foundAdTypes[origIdx][0] || '').toLowerCase(),
            origIdx
        })).sort((a: any, b: any) => a.pubDate - b.pubDate)
        .map(({ key, origIdx, foundLength, foundUnit, ...rest }: any) => {
            if (!foundLengthsByKey[key]) {
                foundLengthsByKey[key] = { pre: [], mid: [], post: [] };
            }
            foundLengthsByKey[key][foundUnit] = _.concat(foundLengthsByKey[key][foundUnit], ({ foundLength, origIdx }));

            return { key, origIdx, foundLength, foundUnit, ...rest };
        });

    const foundUnitsToStatus = (foundUnits: any, requestedUnits: any) => {
        const origIdxsToStatus: any = {};
        const allFound = _.flatten(_.values(
            _.mapValues(
                foundUnits,
                (lengths: any, unit: any) => !allowedUnits.includes(unit)
                    ? lengths
                    : _.map(lengths, ({ foundLength, origIdx }: any) => ({ origIdx, length: foundLength, unit }))
            )
        )
        );
        const reqLengths = _.first(_.values(requestedUnits).filter((ls: any) => ls.length > 0));

        const getShortStr = (foundLength: number, reqLengths: any) => {
            const match = smartMatchLengthToReqLengths(foundLength / (24 * 60 * 60), reqLengths.join(','));
            const isShort = match.split(':').length > 1 ? parseInt(match.split(':')[1]) > (foundLength + 2) : false;
            // if (isShort) {
            //   console.log(`foundLength==${foundLength}, reqLengths=${reqLengths}, match=${match}`)
            // }
            return isShort ? ' (SHORT)' : '';
        };

        let otherAdsToAssign: any[] = [];

        allowedUnits.map(unit => {
            const numFoundForUnit = _.filter(allFound, { unit }).length;
            const numRequestedForUnit = _.get(requestedUnits, `${unit}.length`, 0);
            const adsFoundForUnit = _.filter(allFound, { unit });

            if (numFoundForUnit <= numRequestedForUnit) {
                return adsFoundForUnit.forEach(({ origIdx, length }: any) => origIdxsToStatus[origIdx] = { status: 'MATCH' + getShortStr(length, reqLengths), unit });
            }

            // there are EXTRAs or MISMATCHES for this unit
            const numOverForUnit = Math.max(numFoundForUnit - numRequestedForUnit, 0);
            _.take(_.sortBy(adsFoundForUnit, ['length', 'origIdx']).reverse(), numRequestedForUnit)
                .forEach(({ origIdx, length }: any) => origIdxsToStatus[origIdx] = { status: 'MATCH' + getShortStr(length, reqLengths), unit });

            otherAdsToAssign = _.concat(otherAdsToAssign, _.take(_.sortBy(adsFoundForUnit, ['length', 'origIdx']), numOverForUnit));
        });

        _.forEach(otherAdsToAssign, ({ origIdx, unit, length }: any) => {
            if (_.get(requestedUnits, 'pre.length', 0) - _.values(origIdxsToStatus).length > 0) {
                return origIdxsToStatus[origIdx] = { status: 'MATCH (MISMATCH)' + getShortStr(length, reqLengths), unit: 'pre' };
            }
            if (_.get(requestedUnits, 'mid.length', 0) - _.values(origIdxsToStatus).length > 0) {
                return origIdxsToStatus[origIdx] = { status: 'MATCH (MISMATCH)' + getShortStr(length, reqLengths), unit: 'mid' };
            }
            if (_.get(requestedUnits, 'post.length', 0) - _.values(origIdxsToStatus).length > 0) {
                return origIdxsToStatus[origIdx] = { status: 'MATCH (MISMATCH)' + getShortStr(length, reqLengths), unit: 'mid' };
            }
            return origIdxsToStatus[origIdx] = {
                status: `EXTRA ${_.filter(allFound, { unit }).length}/${_.get(requestedUnits, `${unit}.length`, 0)}`,
                unit
            };
        });

        return origIdxsToStatus;
    };

    return _.sortBy(withPubDatesSorted, 'origIdx').map(
        ({ key, origIdx }: any) => {
            if (origIdx === 0) {
                return 'Podscribe Status';
            }
            // if (_.get(expectedWks, origIdx) > _.get(foundWks, origIdx)) {
            //   return 'early'
            // }

            return _.get(foundUnitsToStatus(foundLengthsByKey[key], requestCounts[key]), `[${origIdx}].status`);
        }
    );
};
