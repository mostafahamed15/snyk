var debug = require('debug')('snyk');
var test = require('tape');
var proxyquire = require('proxyquire');
var sinon = require('sinon');
var _ = require('lodash');
var spy = sinon.spy();
var wizard = proxyquire('../cli/commands/protect/wizard', {
  inquirer: {
    prompt: function (q, cb) {
      cb(spy(q));
    },
  }
});
var getPrompts = wizard.interactive;

function run(t, offset, filename) {
  if (typeof offset === 'string') {
    filename = offset;
    offset = 0;
  }
  offset += 2;
  spy.reset();
  var vulns = require(filename);
  return getPrompts(vulns).then(function (a) {
    t.ok(!!a, 'prompts loaded');
    var prompts = _.flattenDeep(spy.args);
    // console.log(prompts.map(_ => _.message));
    t.equal(prompts.length, vulns.vulnerabilities.length * 2 + offset, 'found right number of prompts');
    return prompts;
  }).catch(function (e) {
    console.log(e.stack);
    t.bail(e);
  });
}

test('review patches', function (t) {
  run(t, 2, './fixtures/uglify-patch-only.json').then(function (prompts) {
    t.ok(contains(prompts[0], 'review', true), 'review first');
    t.ok(contains(prompts[2], 'patch'), 'patch 2nd');
    t.ok(contains(prompts[4], 'patch'), 'patch 3rd');
    t.end();
  });
});

test('patches also include (non-working) updates', function (t) {
  run(t, 2, './fixtures/uglify-contrived.json').then(function (prompts) {
    t.ok(hasText(prompts[0], 0, 'upgrade'), 'has upgrade');
    t.ok(contains(prompts[0], 'patch', true), 'has patch');
    t.end();
  });
});

test('case 0: no remediation', function (t) {
  run(t, './fixtures/scenarios/case-0.json').then(function (prompts) {
    t.ok(contains(prompts[0], 'ignore'));
    t.end();
  });
});

test('case 1: direct update', function (t) {
  run(t, './fixtures/scenarios/case-1.json').then(function (prompts) {
    t.ok(contains(prompts[0], 'update'));
    t.equal(prompts[0].choices[1].value.choice, 'skip', 'patch is not available, so should skip instead');
    t.end();
  });
});

test('case 2: indirect update', function (t) {
  run(t, './fixtures/scenarios/case-2.json').then(function (prompts) {
    t.ok(contains(prompts[0], 'update'));
    t.equal(prompts[0].choices[1].value.choice, 'skip', 'patch is not available, so should skip instead');
    t.end();
  });
});

test('case 4: upgrades to different versions', function (t) {
  run(t, 2, './fixtures/scenarios/case-4.json').then(function (prompts) {
    t.ok(contains(prompts[0], 'review'));
    t.ok(contains(prompts[0], 'update'));

    t.ok(contains(prompts[2], 'update'));
    t.equal(prompts[2].choices[1].value.choice, 'skip', 'patch is not available, so should skip instead');

    t.ok(contains(prompts[4], 'update'));
    t.equal(prompts[4].choices[1].value.choice, 'skip', 'patch is not available, so should skip instead');

    t.end();
  });
});


test('case 5: two patches modify the same files', function (t) {
  run(t, 2, './fixtures/scenarios/case-5.json').then(function (prompts) {
    t.ok(contains(prompts[0], 'review', true), 'review first');
    t.ok(contains(prompts[0], 'patch'), 'path in review');

    t.ok(contains(prompts[2], 'patch'));
    t.ok(contains(prompts[4], 'patch'));

    // first optional patch should be the latest one
    var a = prompts[2].choices[0].value.vuln.publicationTime;
    var b = prompts[4].choices[0].value.vuln.publicationTime;
    t.ok(a > b, 'publicationTime is ordered by newest');

    t.end();
  });
});

function contains(question, value, patchWithUpdate) {
  var positions = {
    review: patchWithUpdate ? 2 : 1,
    patch: 1,
    update: 0,
    ignore: 2,
    skip: 3,
  };

  showChoices(question);
  debug(question.choices[positions[value]].value.choice);

  return question.choices[positions[value]].value.choice === value;
}

function hasText(question, position, value) {
  debug(question.choices[position].name.toLowerCase(), value.toLowerCase());
  var index = question.choices[position].name.toLowerCase().indexOf(value.toLowerCase());
  debug(index);
  // showChoices(question);

  return index !== -1;
}

function showChoices(question) {
  // console.log(question.choices.map(function (v) {
  //   return v;
  // }));
}
