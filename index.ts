const _ = LodashGS.load();
// import * as _ from 'lodash';
'use strict';
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) {if (Object.prototype.hasOwnProperty.call(s, p))
            {t[p] = s[p];}}
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) {if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
    {t[p] = s[p];}}
    if (s != null && typeof Object.getOwnPropertySymbols === 'function')
    {for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
        if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
        {t[p[i]] = s[p[i]];}
    }}
    return t;
};
exports.__esModule = true;
// const _ = LodashGS.load();
// var _ = require('lodash');
function generateClientTabFormula(clientName) {
    return '\n  getClientAirchecks(\n  QUERY(Airchecks!A:AX,"select * where F = \'' + clientName + '\' and AM = TRUE order by D", 1),\n  QUERY(\'Radio Airchecks\'!A:AD,"select * where C = \'' + clientName + '\' and V = TRUE order by B", 1),\n  QUERY(\'Special Drop Off Request\'!A:AM,"select * where A = \'' + clientName + '\' order by C", 1)\n)';
}
;
function generateClientTabs() {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName('Airchecks');
    var last = sheet.getLastRow();
    for (var i = 1; i < last; i++) {
        var tabName = sheet.getRange(i + 6, 6).getValue();
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
var colNameMap = {
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
function getClientAirchecks(podcastAdsFiltered, radioAdsFiltered, specialFiltered) {
    if (!Array.isArray(podcastAdsFiltered)) {
        return podcastAdsFiltered;
    }
    var mainHeaders = _.get(podcastAdsFiltered, '[0]');
    var headerstoRadioColIdx = _.fromPairs(_.map(mainHeaders, function (colName) { return [colName, _.indexOf(_.get(radioAdsFiltered, '[0]', []), _.get(colNameMap, colName, colName))]; }));
    var headerstoSpecialColIdx = _.fromPairs(_.map(mainHeaders, function (colName) { return [colName, _.indexOf(_.get(specialFiltered, '[0]', []), _.get(colNameMap, colName, colName))]; }));
    var colIdxsToRemove = _.map([
        'Download Date (PST)',
        'Ad Audio Link (Direct Download)',
        'Script Link',
        'Episode Link',
        'Transcript Link',
        'Podscribe Ad ID',
    ], function (colName) { return _.indexOf(mainHeaders, colName); });
    return _.concat([mainHeaders], _.orderBy(_.concat(podcastAdsFiltered.slice(1), _.map(_.slice(radioAdsFiltered, 1), function (row) { return mainHeaders.map(function (colName) { return _.get(row, '[' + headerstoRadioColIdx[colName] + ']'); }); }), _.map(_.slice(specialFiltered, 1), function (row) { return mainHeaders.map(function (colName) { return _.get(row, '[' + headerstoSpecialColIdx[colName] + ']'); }); })), function (r) { return r[3]; })).map(function (row) { return _.filter(row, function (_v, idx) { return !colIdxsToRemove.includes(idx); }); });
}
;
var secToDayFract = function (secs) {
    return typeof secs !== 'string' ? '' : parseInt(secs) / (60 * 60 * 24);
};
function smartMatchLengthToReqLengths(exactLength, reqLengths) {
    if (!reqLengths.includes(',')) {
        return reqLengths;
    }
    var closestMatch;
    // if (Math.round(exactLength) === 44) {
    // console.log(`sm, el==${exactLength}, rls=${reqLengths}`)
    // }
    reqLengths.split(',')
        .map(function (reqLength) { return reqLength.includes(':') ? secToDayFract(reqLength.split(':')[1]) : null; })
        .filter(function (rs) { return rs != null; })
        .forEach(function (length) {
            if (!closestMatch || (Math.abs(length - exactLength) < Math.abs(closestMatch - exactLength))) {
                closestMatch = length;
            }
        });
    return closestMatch ? ':' + Math.round(closestMatch * 24 * 60 * 60) : '-';
}
;
function smarterAdLength(requestedAdLengths, exactAdLengths) {
    return !Array.isArray(requestedAdLengths)
        ? requestedAdLengths
        : requestedAdLengths.map(function (row, idx) { return row.map(function (cell) { return smartMatchLengthToReqLengths(exactAdLengths[idx][0], cell); }); });
}
;
function parseLengths(lengthStr) {
    try {
        return lengthStr
            .trim()
            .replace(' /g', ',')
            .split(',')
            .map(function (str) { return _.get(str.split('-'), '[0]'); })
            .filter(function (l) { return !!l; })
            .map(function (str) { return parseInt(str); });
    }
    catch (err) {
        Logger.log(err);
    }
}
;
var allowedUnits = ['pre', 'mid', 'post'];
function isExtra(showIdSponsorReqweek, pubDates, foundAdTypes, foundAdLengths, requests) {
    var requestCounts = {};
    _.filter(requests, function (req) { return !!req[6]; })
        .forEach(function (req) {
            var key = req[0].toLowerCase();
            if (!requestCounts[key]) {
                requestCounts[key] = { pre: [], mid: [], post: [] };
            }
            (req[6] || '')
                .replace(/[\+ ]/g, ',')
                .split(',')
                .map(function (u) { return (u || '').toLowerCase().trim(); })
                .filter(function (unit) { return allowedUnits.includes(unit); })
                .forEach(function (unit) { return requestCounts[key][unit] = requestCounts[key][unit].concat(req[7]); }); // length
        });
    var foundLengthsByKey = {};
    var withPubDatesSorted = showIdSponsorReqweek
        .map(function (k, origIdx) { return ({
            key: k[0].toLowerCase(),
            pubDate: new Date(pubDates[origIdx][0]).getTime(),
            foundLength: foundAdLengths[origIdx][0] * 24 * 60 * 60,
            foundUnit: (foundAdTypes[origIdx][0] || '').toLowerCase(),
            origIdx: origIdx
        }); }).sort(function (a, b) { return a.pubDate - b.pubDate; })
        .map(function (_a) {
            var key = _a.key, origIdx = _a.origIdx, foundLength = _a.foundLength, foundUnit = _a.foundUnit, rest = __rest(_a, ['key', 'origIdx', 'foundLength', 'foundUnit']);
            if (!foundLengthsByKey[key]) {
                foundLengthsByKey[key] = { pre: [], mid: [], post: [] };
            }
            foundLengthsByKey[key][foundUnit] = _.concat(foundLengthsByKey[key][foundUnit], ({ foundLength: foundLength, origIdx: origIdx }));
            return __assign({ key: key, origIdx: origIdx, foundLength: foundLength, foundUnit: foundUnit }, rest);
        });
    var foundUnitsToStatus = function (foundUnits, requestedUnits) {
        var origIdxsToStatus = {};
        var allFound = _.flatten(_.values(_.mapValues(foundUnits, function (lengths, unit) { return !allowedUnits.includes(unit)
            ? lengths
            : _.map(lengths, function (_a) {
                var foundLength = _a.foundLength, origIdx = _a.origIdx;
                return ({ origIdx: origIdx, length: foundLength, unit: unit });
            }); })));
        var reqLengths = _.first(_.values(requestedUnits).filter(function (ls) { return ls.length > 0; }));
        var getShortStr = function (foundLength, reqLengths) {
            var match = smartMatchLengthToReqLengths(foundLength / (24 * 60 * 60), reqLengths.join(','));
            var isShort = match.split(':').length > 1 ? parseInt(match.split(':')[1]) > (foundLength + 2) : false;
            return isShort ? ' (SHORT)' : '';
        };
        var otherAdsToAssign = [];
        allowedUnits.map(function (unit) {
            var numFoundForUnit = _.filter(allFound, { unit: unit }).length;
            var numRequestedForUnit = _.get(requestedUnits, unit + '.length', 0);
            var adsFoundForUnit = _.filter(allFound, { unit: unit });
            if (numFoundForUnit <= numRequestedForUnit) {
                return adsFoundForUnit.forEach(function (_a) {
                    var origIdx = _a.origIdx, length = _a.length;
                    return origIdxsToStatus[origIdx] = { status: 'MATCH' + getShortStr(length, reqLengths), unit: unit };
                });
            }
            // there are EXTRAs or MISMATCHES for this unit
            var numOverForUnit = Math.max(numFoundForUnit - numRequestedForUnit, 0);
            _.take(_.sortBy(adsFoundForUnit, ['length', 'origIdx']).reverse(), numRequestedForUnit)
                .forEach(function (_a) {
                    var origIdx = _a.origIdx, length = _a.length;
                    return origIdxsToStatus[origIdx] = { status: 'MATCH' + getShortStr(length, reqLengths), unit: unit };
                });
            otherAdsToAssign = _.concat(otherAdsToAssign, _.take(_.sortBy(adsFoundForUnit, ['length', 'origIdx']), numOverForUnit));
        });
        _.forEach(otherAdsToAssign, function (_a) {
            var origIdx = _a.origIdx, unit = _a.unit, length = _a.length;
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
                status: 'EXTRA ' + _.filter(allFound, { unit: unit }).length + '/' + _.get(requestedUnits, unit + '.length', 0),
                unit: unit
            };
        });
        return origIdxsToStatus;
    };
    return _.sortBy(withPubDatesSorted, 'origIdx').map(function (_a) {
        var key = _a.key, origIdx = _a.origIdx;
        return _.get(foundUnitsToStatus(foundLengthsByKey[key], requestCounts[key]), '[' + origIdx + '].status');
    });
}
;
var reconHeaders = [
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
function getRecon(requests, ads) {
    var adLookup = {};
    var i = 0;
    _.forEach(ads, function (ad) {
        adLookup[ad[0].toLowerCase()] = _.concat(_.get(adLookup, ad[0].toLowerCase(), []), [ad]).sort(function (a, b) { return a[2] - b[2]; });
    });
    var formatStatus = function (ad) {
        if (ad.length === 0) {
            return 'MISSING';
        }
        ;
        return _.get(ad, '[3]', '');
        // const podStatus = _.get(ad, '[3]', '').split(' ')[0];
        // switch (podStatus) {
        //   case 'EXTRA': return 'EXTRA';
        //   case 'MATCH': return 'MATCH';
        //   default: return `MATCH (${podStatus})`
        // }
    };
    var allMatchedAds = new Set();
    var res = _.flatMap(_.filter(requests.slice(1), function (r) { return !!r[0]; }), function (req) {
        // only take 1 match, or extras
        var adsMatchingReq = new Set();
        var adsToMatch = _.get(adLookup, req[0].toLowerCase(), [[]]).filter(function (a) { return !allMatchedAds.has(a[7]); });
        // match all extra
        adsToMatch
            .filter(function (a) { return _.get(a, '[3]', '').includes('EXTRA'); })
            .map(function (a) {
                allMatchedAds.add(a[7]);
                adsMatchingReq.add(a);
            });
        // take one MATCH
        _.slice(adsToMatch.filter(function (a) { return _.get(a, '[3]', '').includes('MATCH'); }), 0, 1).map(function (a) {
            allMatchedAds.add(a[7]);
            adsMatchingReq.add(a);
        });
        return _.map(Array.from(adsMatchingReq).length > 0 ? Array.from(adsMatchingReq) : [[]], function (ad) { return [
            req[12],
            _.get(ad, '[1]', ''),
            req[8],
            req[4],
            req[5],
            req[2],
            req[9],
            req[6],
            _.get(ad, '[4]', '').slice(0, 1) + _.get(ad, '[4]', '').slice(1).toLowerCase(),
            // secToDayFract(_.get(req, '[7]', '').split(":")[1]), // paid ad length
            smartMatchLengthToReqLengths(_.get(ad, '[6]', 0) * 24 * 60 * 60, req[7]),
            _.get(ad, '[6]', ''),
            req[3],
            _.get(ad, '[2]', ''),
            formatStatus(ad)
        ]; });
    });
    return _.concat([reconHeaders], res);
}
;
function isExtraAF(showIdSponsorReqweek, pubDates, foundAdTypes, foundAdLengths, requests, expectedWks, foundWks) {
    // console.log("show id req wk===", showIdSponsorReqweek);
    var requestCounts = {};
    _.filter(requests, function (req) { return !!req[6]; })
        .forEach(function (req) {
            var key = req[0].toLowerCase();
            if (!requestCounts[key]) {
                requestCounts[key] = { pre: [], mid: [], post: [] };
            }
            (req[6] || '')
                .replace(/[\+ ]/g, ',')
                .split(',')
                .map(function (u) { return (u || '').toLowerCase().trim(); })
                .filter(function (unit) { return allowedUnits.includes(unit); })
                .forEach(function (unit) { return requestCounts[key][unit] = requestCounts[key][unit].concat(req[7]); }); // length
        });
    var foundLengthsByKey = {};
    var withPubDatesSorted = showIdSponsorReqweek
        .map(function (k, origIdx) { return ({
            key: k[0].toLowerCase(),
            pubDate: new Date(pubDates[origIdx][0]).getTime(),
            foundLength: foundAdLengths[origIdx][0] * 24 * 60 * 60,
            foundUnit: (foundAdTypes[origIdx][0] || '').toLowerCase(),
            origIdx: origIdx
        }); }).sort(function (a, b) { return a.pubDate - b.pubDate; })
        .map(function (_a) {
            var key = _a.key, origIdx = _a.origIdx, foundLength = _a.foundLength, foundUnit = _a.foundUnit, rest = __rest(_a, ['key', 'origIdx', 'foundLength', 'foundUnit']);
            if (!foundLengthsByKey[key]) {
                foundLengthsByKey[key] = { pre: [], mid: [], post: [] };
            }
            foundLengthsByKey[key][foundUnit] = _.concat(foundLengthsByKey[key][foundUnit], ({ foundLength: foundLength, origIdx: origIdx }));
            return __assign({ key: key, origIdx: origIdx, foundLength: foundLength, foundUnit: foundUnit }, rest);
        });
    var foundUnitsToStatus = function (foundUnits, requestedUnits) {
        var origIdxsToStatus = {};
        var allFound = _.flatten(_.values(_.mapValues(foundUnits, function (lengths, unit) { return !allowedUnits.includes(unit)
            ? lengths
            : _.map(lengths, function (_a) {
                var foundLength = _a.foundLength, origIdx = _a.origIdx;
                return ({ origIdx: origIdx, length: foundLength, unit: unit });
            }); })));
        var reqLengths = _.first(_.values(requestedUnits).filter(function (ls) { return ls.length > 0; }));
        var getShortStr = function (foundLength, reqLengths) {
            var match = smartMatchLengthToReqLengths(foundLength / (24 * 60 * 60), reqLengths.join(','));
            var isShort = match.split(':').length > 1 ? parseInt(match.split(':')[1]) > (foundLength + 2) : false;
            // if (isShort) {
            //   console.log(`foundLength==${foundLength}, reqLengths=${reqLengths}, match=${match}`)
            // }
            return isShort ? ' (SHORT)' : '';
        };
        var otherAdsToAssign = [];
        allowedUnits.map(function (unit) {
            var numFoundForUnit = _.filter(allFound, { unit: unit }).length;
            var numRequestedForUnit = _.get(requestedUnits, unit + '.length', 0);
            var adsFoundForUnit = _.filter(allFound, { unit: unit });
            if (numFoundForUnit <= numRequestedForUnit) {
                return adsFoundForUnit.forEach(function (_a) {
                    var origIdx = _a.origIdx, length = _a.length;
                    return origIdxsToStatus[origIdx] = { status: 'MATCH' + getShortStr(length, reqLengths), unit: unit };
                });
            }
            // there are EXTRAs or MISMATCHES for this unit
            var numOverForUnit = Math.max(numFoundForUnit - numRequestedForUnit, 0);
            _.take(_.sortBy(adsFoundForUnit, ['length', 'origIdx']).reverse(), numRequestedForUnit)
                .forEach(function (_a) {
                    var origIdx = _a.origIdx, length = _a.length;
                    return origIdxsToStatus[origIdx] = { status: 'MATCH' + getShortStr(length, reqLengths), unit: unit };
                });
            otherAdsToAssign = _.concat(otherAdsToAssign, _.take(_.sortBy(adsFoundForUnit, ['length', 'origIdx']), numOverForUnit));
        });
        _.forEach(otherAdsToAssign, function (_a) {
            var origIdx = _a.origIdx, unit = _a.unit, length = _a.length;
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
                status: 'EXTRA ' + _.filter(allFound, { unit: unit }).length + '/' + _.get(requestedUnits, unit + '.length', 0),
                unit: unit
            };
        });
        return origIdxsToStatus;
    };
    return _.sortBy(withPubDatesSorted, 'origIdx').map(function (_a) {
        var key = _a.key, origIdx = _a.origIdx;
        if (origIdx === 0) {
            return 'Podscribe Status';
        }
        // if (_.get(expectedWks, origIdx) > _.get(foundWks, origIdx)) {
        //   return 'early'
        // }
        return _.get(foundUnitsToStatus(foundLengthsByKey[key], requestCounts[key]), '[' + origIdx + '].status');
    });
}
;
