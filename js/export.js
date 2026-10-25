// Ссылки на карты и экспорт в файлы (KML для Google My Maps, GPX для офлайн-карт, CSV)
(function () {
  var CITY_NAME = { sg: 'Singapore', seoul: 'Seoul, South Korea', korea: 'South Korea', cn: 'China' };
  var GENERIC = /везде|по всему|все аэропорты|разные/i;

  function isGeneric(p) { return p.custom || GENERIC.test(p.area || ''); }
  function q(p) { return p.name.split(' — ')[0] + ', ' + CITY_NAME[p.city]; }

  var links = {
    google: function (p) {
      return 'https://www.google.com/maps/search/?api=1&query=' +
        encodeURIComponent(isGeneric(p) ? p.lat + ',' + p.lng : q(p));
    },
    apple: function (p) {
      return 'https://maps.apple.com/?q=' + encodeURIComponent(p.name.split(' — ')[0]) + '&ll=' + p.lat + ',' + p.lng;
    },
    naver: function (p) {
      return 'https://map.naver.com/p/search/' + encodeURIComponent(p.name.split(' — ')[0].split(' (')[0]);
    },
    kakao: function (p) {
      return 'https://map.kakao.com/link/map/' + encodeURIComponent(p.name.split(' — ')[0].replace(/,/g, ' ')) + ',' + p.lat + ',' + p.lng;
    },
    route: function (list) {
      // Маршрут дня в Google Maps: до 9 промежуточных точек
      if (!list.length) return '';
      var pts = list.map(function (p) { return p.lat + ',' + p.lng; });
      var url = 'https://www.google.com/maps/dir/?api=1&travelmode=walking&destination=' + pts[pts.length - 1];
      if (pts.length > 1) url += '&origin=' + pts[0];
      if (pts.length > 2) url += '&waypoints=' + encodeURIComponent(pts.slice(1, -1).slice(0, 9).join('|'));
      return url;
    }
  };

  function xml(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function describe(p, extra) {
    var parts = [p.area, p.desc];
    if (p.tip) parts.push('Совет: ' + p.tip);
    if (extra) parts.push(extra);
    parts.push(links.google(p));
    return parts.filter(Boolean).join('\n\n');
  }

  function kml(title, groups) {
    // groups: [{name, places:[{p, extra}]}]
    var out = ['<?xml version="1.0" encoding="UTF-8"?>',
      '<kml xmlns="http://www.opengis.net/kml/2.2"><Document><name>' + xml(title) + '</name>'];
    groups.forEach(function (g) {
      out.push('<Folder><name>' + xml(g.name) + '</name>');
      g.places.forEach(function (it) {
        var p = it.p;
        out.push('<Placemark><name>' + xml(p.name) + '</name><description>' + xml(describe(p, it.extra)) +
          '</description><Point><coordinates>' + p.lng + ',' + p.lat + ',0</coordinates></Point></Placemark>');
      });
      out.push('</Folder>');
    });
    out.push('</Document></kml>');
    return out.join('\n');
  }

  function gpx(title, groups) {
    var out = ['<?xml version="1.0" encoding="UTF-8"?>',
      '<gpx version="1.1" creator="trip-swipe" xmlns="http://www.topografix.com/GPX/1/1"><metadata><name>' + xml(title) + '</name></metadata>'];
    groups.forEach(function (g) {
      g.places.forEach(function (it) {
        var p = it.p;
        out.push('<wpt lat="' + p.lat + '" lon="' + p.lng + '"><name>' + xml(p.name) + '</name><desc>' +
          xml(describe(p, it.extra)) + '</desc><type>' + xml(g.name) + '</type></wpt>');
      });
    });
    out.push('</gpx>');
    return out.join('\n');
  }

  function csv(groups) {
    var rows = [['Name', 'Latitude', 'Longitude', 'Group', 'Area', 'Description', 'Google Maps']];
    groups.forEach(function (g) {
      g.places.forEach(function (it) {
        var p = it.p;
        rows.push([p.name, p.lat, p.lng, g.name, p.area, (p.desc + (it.extra ? ' | ' + it.extra : '')), links.google(p)]);
      });
    });
    return '﻿' + rows.map(function (r) {
      return r.map(function (c) { c = String(c == null ? '' : c); return /[",\n;]/.test(c) ? '"' + c.replace(/"/g, '""') + '"' : c; }).join(',');
    }).join('\r\n');
  }

  function text(groups) {
    return groups.map(function (g) {
      return '— ' + g.name + ' —\n' + g.places.map(function (it, i) {
        return (i + 1) + '. ' + it.p.name + (it.extra ? ' (' + it.extra + ')' : '') + '\n   ' + links.google(it.p);
      }).join('\n');
    }).join('\n\n');
  }

  function download(name, content, type) {
    var blob = new Blob([content], { type: type });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
  }

  window.TripExport = { links: links, kml: kml, gpx: gpx, csv: csv, text: text, download: download };
})();
