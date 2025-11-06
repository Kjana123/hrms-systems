// utils/helpers.js
console.log(`[FILE_LOAD_CHECK] utils/helpers.js loaded at ${new Date().toISOString()}`);

const moment = require('moment-timezone');

// Device detection function
function getDeviceType(userAgent) {
  if (!userAgent) return 'Unknown';
  userAgent = userAgent.toLowerCase();
  const mobileRegex = /(android|bb\d+|meego).+mobile|avantgo|bada\/|blackberry|blazer|compal|elaine|fennec|hiptop|iemobile|ip(hone|od)|iris|kindle|lge |maemo|midp|mmp|mobile.+firefox|netfront|opera m(ob|in)i|palm( os)?|phone|p(ixi|rim)|plucker|pocket|psp|series(4|6)0|symbian|treo|up\.(browser|link)|vodafone|wap|windows ce|xda|xiino/i;
  const mobileShortRegex = /1207|6310|6590|3gso|4thp|50[1-6]i|770s|802s|a wa|abac|ac(er|oo|er)|ai(ko|ob)|al(av|ca|co)|amoi|an(d|ex)|android|anni|appleinc|aurora|azumi|bb(cd|me)|bd(eg|me|ul)|bi(lo|mr)|bn(w|r)|bq(mo|ro|sm)|br(ex|me)|bs(at|lo)|ebsm|bw(n|v)|c55|capi|ccwa|cdm|cell|chtm|cldc|cmd|co(mp|nd)|craw|da(it|ul)|dc(ad|dc)|dm(f|f)|di(or|od)|ds(ad|at|ed)|el(at|fl)|er(c|l)|es(ad|eo)|ez([4-7]0|os|wa|ze)|fetc|fly(|_)|g1 u|g560|gene|gf5|gmo|go(\.w|od)|gr(ad|un)|haie|hcit|hd(ad|at)|hell|hf-pd|hg(ar|ht|lg)|htc(| pro4|omg)|hu(aw|xe)|i-de|id(gu|hn)|ip(ao|im)|iq(|12|ty)|is(go|ro)|joda|kddi|keji|kgt(| eg)|klon|kpt |kwc|kyo(| m)|le(no|xi)|lg( g|¹5|³0|uqa|v)|libw|lynx|m1-w|m3ga|m50\/|ma(te|ui|xo)|mc(ad|ev)|me(wa|on)|mwbp|mi(0a|th|v4a)|mz(go|nk)|ne(|ro|on)|nokia|op(ti|nv)|oran|owg1|pda|pg(13|g1)|pl(ay|ox)|pn-up|po(ck|fe)|py(g|re)|qatek|qc(07|12|21|32|60|61|71|ia)|qv-gf|ndc|rd(c|st|wf)|rh(no|pt)|ri(co|gr)|rm9d|rp(l|sl)|rw(er|as)|s55\/|sa(ge|ma|mm)|s([46]|g[56]0|h4)|sc(01|h1|st|tp)|sdk\/|se(c(|0|1)|47|mc|up|si|em)|sgh(| tu)|shar|sie(|m)|sk-0|sl(45|id)|sm(al|ar|b3|it|t5)|so(ft|ny)|sp(us|v1)|sy(01|mb)|t2(mo|v2)|tdg|tel(i|m)|tim |t-mo|tkwa|tcl|tdg|tele|tfen|th(lb|ty)|ti-mo|top(mo|la)|tr(ad|ev)|ts(d|r)|up(\.b|g1|si)|utst|v400|v750|veri|vi(rg|te)|vk(40|5[03]|v1)|vm40|voda|vulc|w3c |wapa|wc(p|es)|webc|whit|wi(g |nw)|wmlb|wonu|x700|yas |your|zeto|zte-/i;
  if (mobileRegex.test(userAgent) || mobileShortRegex.test(userAgent.substring(0, 4))) {
    return 'Mobile';
  }
  if (/ipad|tablet|android(?!.*mobile)|kindle|playbook|silk/i.test(userAgent)) {
    return 'Tablet';
  }
  if (/windows|macintosh|linux|x11|cros/i.test(userAgent)) {
    return 'Desktop';
  }
  if (/bot|crawl|spider|mediapartners|adsbot|headless/i.test(userAgent)) {
    return 'Bot/Crawler';
  }
  if (/smarttv|googletv|appletv/i.test(userAgent)) {
    return 'Smart TV';
  }
  if (/console|playstation|xbox|nintendo/i.test(userAgent)) {
    return 'Gaming Console';
  }
  return 'Other';
}

const calculateAttendanceMetrics = (checkInTimeStr, checkOutTimeStr, expectedShiftStartTimeStr) => {
    let lateTime = 0;
    let workingHours = 0;
    let extraHours = 0;
    let status = 'ABSENT'; // Default, will be updated to PRESENT/LATE if check-in/out exist

    const expectedShiftStartMoment = moment(expectedShiftStartTimeStr, 'HH:mm:ss');

    let checkInMoment = null;
    let checkOutMoment = null;

    if (checkInTimeStr) {
        checkInMoment = moment(checkInTimeStr, 'HH:mm:ss');
    }
    if (checkOutTimeStr) {
        checkOutMoment = moment(checkOutTimeStr, 'HH:mm:ss');
    }

    if (checkInMoment) {
        // Calculate Late Time
        if (checkInMoment.isAfter(expectedShiftStartMoment)) {
            lateTime = parseFloat((checkInMoment.diff(expectedShiftStartMoment, 'minutes')).toFixed(2));
            status = 'LATE'; // Mark as LATE if checked in after expected time
        } else {
            status = 'PRESENT'; // Otherwise, if checked in, it's PRESENT
        }
    }

    if (checkInMoment && checkOutMoment) {
        // Calculate Working Hours
        if (checkOutMoment.isAfter(checkInMoment)) {
            workingHours = parseFloat((checkOutMoment.diff(checkInMoment, 'minutes') / 60).toFixed(2));
        } else {
            // Handle overnight shifts if necessary, or set to 0 for simplicity
            workingHours = 0;
        }

        // Calculate Extra Hours (assuming 8.5 standard working hours)
        const standardWorkingHours = 8.5;
        if (workingHours > standardWorkingHours) {
            extraHours = parseFloat((workingHours - standardWorkingHours).toFixed(2));
        }
    }

    return { lateTime, workingHours, extraHours, status };
};


module.exports = {
  getDeviceType,
  calculateAttendanceMetrics,
};