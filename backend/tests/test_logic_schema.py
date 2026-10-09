"""Logic v2 models (schemas/logic.py) and their cross-reference checks against a form (services/logic_check.py)."""

from types import SimpleNamespace

import pytest
from pydantic import ValidationError

from app.schemas.logic import (
    Logic,
    check_url_parameters,
    check_variables,
)
from app.services.logic_check import FormState, check_logic, check_outcome

OPTIONS = {"options": [{"id": "a", "label": "A"}, {"id": "b", "label": "B"}], "allow_multiple": False}


def when(*conditions, match="all"):
    return {"match": match, "conditions": list(conditions)}


def cond(source, op="is", value="a"):
    return {"source": source, "op": op, "value": value}


def logic(*, rules=(), otherwise=None, calc=()):
    return {"version": 2, "branch": {"rules": list(rules), "otherwise": otherwise}, "calc": list(calc)}


def rule(to, *conditions, match="all"):
    return {"to": to, "when": when(*conditions, match=match)}


def question(id, type="short_text", position=None, properties=None, group_id=None):
    return SimpleNamespace(
        id=id, type=type, position=id - 1 if position is None else position, properties=properties or {}, group_id=group_id
    )


def state(**overrides):
    base = {
        "questions": [
            question(1, "multiple_choice", properties=OPTIONS),
            question(2, "number"),
            question(3, "multiple_choice", properties=OPTIONS),
            question(4, "short_text"),
            question(5, "statement"),
            question(6, "group"),
        ],
        "ending_ids": {10, 11},
        "variables": [
            {"name": "score", "type": "number", "initial": 0},
            {"name": "tag", "type": "text", "initial": "vip"},
        ],
        "url_parameters": ["utm_source"],
    }
    return FormState(**{**base, **overrides})


def check(data, on=3, prefix="logic", **overrides):
    st = state(**overrides)
    current = next(q for q in st.questions if q.id == on)
    return check_logic(st, current, data, prefix)


# ---- the models -------------------------------------------------------------


def test_valid_logic_is_returned_in_the_documented_shape():
    data = logic(
        rules=[rule({"question": 4}, cond({"question": 1}), cond({"variable": "score"}, "gte", 5), match="any")],
        otherwise={"ending": 10},
        calc=[{"op": "add", "value": {"number": 2.5}, "variable": "score", "when": when(cond({"question": 1}))}],
    )
    clean, errors = check(data)
    assert errors == {}
    assert clean == data


def test_branch_and_calc_default_to_empty_and_empty_logic_is_stored_as_null():
    assert check({"version": 2})[0] is None
    assert check(logic())[0] is None
    assert check(logic(otherwise={"end": True}))[0] == logic(otherwise={"end": True})


def test_rejects_the_v1_shape():
    clean, errors = check({"rules": [{"op": "is", "value": "a", "to": "end"}]})
    assert clean is None
    assert "logic.rules" in errors and "logic.version" in errors


@pytest.mark.parametrize(
    "mutate",
    [
        lambda d: d.update(version=1),
        lambda d: d.update(extra=1),
        lambda d: d["branch"].update(extra=1),
        lambda d: d["calc"].append({"op": "set", "value": {"number": 1}, "variable": "score", "when": when(cond({"question": 1}))}),
    ],
)
def test_unknown_keys_and_versions_are_rejected(mutate):
    data = logic()
    mutate(data)
    clean, errors = check(data)
    assert clean is None and errors


def test_limits_on_rules_calculations_and_conditions():
    one = rule({"question": 4}, cond({"question": 1}))
    assert check(logic(rules=[one] * 20))[1] == {}
    assert "logic.branch.rules" in check(logic(rules=[one] * 21))[1]

    calc = {"op": "add", "value": {"number": 1}, "variable": "score", "when": when(cond({"question": 1}))}
    assert check(logic(calc=[calc] * 20))[1] == {}
    assert "logic.calc" in check(logic(calc=[calc] * 21))[1]

    assert check(logic(rules=[rule({"question": 4}, *[cond({"question": 1})] * 10)]))[1] == {}
    assert "logic.branch.rules.0.when.conditions" in check(
        logic(rules=[rule({"question": 4}, *[cond({"question": 1})] * 11)])
    )[1]
    assert "logic.branch.rules.0.when.conditions" in check(logic(rules=[rule({"question": 4})]))[1]
    assert "logic.branch.rules.0.when.match" in check(logic(rules=[rule({"question": 4}, cond({"question": 1}), match="some")]))[1]


@pytest.mark.parametrize(
    ("source", "key"),
    [
        ({}, "logic.branch.rules.0.when.conditions.0.source"),
        ({"question": 1, "variable": "score"}, "logic.branch.rules.0.when.conditions.0.source"),
        ({"question": "1"}, "logic.branch.rules.0.when.conditions.0.source.question"),
        ({"question": True}, "logic.branch.rules.0.when.conditions.0.source.question"),
        ({"other": 1}, "logic.branch.rules.0.when.conditions.0.source.other"),
    ],
)
def test_a_source_names_exactly_one_thing(source, key):
    clean, errors = check(logic(rules=[rule({"question": 4}, cond(source))]))
    assert clean is None and key in errors


@pytest.mark.parametrize(
    "target",
    [{}, {"question": 4, "end": True}, {"end": False}, {"question": "4"}, {"ending": True}, "end"],
)
def test_a_target_names_exactly_one_thing(target):
    clean, errors = check(logic(rules=[rule(target, cond({"question": 1}))]))
    assert clean is None and any(key.startswith("logic.branch.rules.0.to") for key in errors)


# ---- question sources ---------------------------------------------------------


def test_question_conditions_go_through_the_type_registry():
    ok = rule({"question": 4}, cond({"question": 1}, "is_not", "b"), cond({"question": 2}, "gte", 18))
    assert check(logic(rules=[ok]), on=4)[1] == {}

    bad_op = rule({"question": 4}, cond({"question": 2}, "is", "x"))
    assert "logic.branch.rules.0.when.conditions.0.op" in check(logic(rules=[bad_op]), on=4)[1]
    bad_value = rule({"question": 4}, cond({"question": 1}, "is", 3))
    assert "logic.branch.rules.0.when.conditions.0.value" in check(logic(rules=[bad_value]), on=4)[1]
    bad_number = rule({"question": 4}, cond({"question": 2}, "gt", "5"))
    assert "logic.branch.rules.0.when.conditions.0.value" in check(logic(rules=[bad_number]), on=4)[1]


def test_a_condition_may_read_the_current_or_an_earlier_question_only():
    own = rule({"question": 4}, cond({"question": 3}))
    assert check(logic(rules=[own]), on=3)[1] == {}
    later = rule({"question": 4}, cond({"question": 3}))
    assert "logic.branch.rules.0.when.conditions.0.source" in check(logic(rules=[later]), on=1)[1]
    missing = rule({"question": 4}, cond({"question": 99}))
    assert "logic.branch.rules.0.when.conditions.0.source" in check(logic(rules=[missing]))[1]


def test_unanswerable_questions_cannot_be_a_source():
    statement = rule({"question": 6}, cond({"question": 5}))
    errors = check(logic(rules=[statement]), on=4, questions=[question(5, "statement", position=0), question(4, "short_text", position=1), question(6, "short_text", position=2)])[1]
    assert "logic.branch.rules.0.when.conditions.0.source" in errors


# ---- variable and URL parameter sources ------------------------------------------


def test_number_and_text_variables_take_their_own_operators():
    ok = rule(
        {"question": 4},
        cond({"variable": "score"}, "lt", 5),
        cond({"variable": "score"}, "neq", 0.5),
        cond({"variable": "tag"}, "contains", "vi"),
        cond({"variable": "tag"}, "is_not", "x"),
    )
    assert check(logic(rules=[ok]))[1] == {}

    key = "logic.branch.rules.0.when.conditions.{}"
    for source, op, value, field in [
        ({"variable": "score"}, "is", 5, "op"),
        ({"variable": "score"}, "gt", "5", "value"),
        ({"variable": "score"}, "gt", True, "value"),
        ({"variable": "tag"}, "gt", "x", "op"),
        ({"variable": "tag"}, "is", 5, "value"),
        ({"variable": "tag"}, "is", "", "value"),
        ({"variable": "tag"}, "is", "x" * 501, "value"),
        ({"variable": "nope"}, "is", "x", "source"),
    ]:
        errors = check(logic(rules=[rule({"question": 4}, cond(source, op, value))]))[1]
        assert key.format(0) + "." + field in errors, (source, op, value, errors)


def test_url_parameter_conditions():
    ok = rule({"question": 4}, cond({"param": "utm_source"}, "contains", "goo"))
    assert check(logic(rules=[ok]))[1] == {}
    for source, op, value, field in [
        ({"param": "utm_source"}, "eq", "x", "op"),
        ({"param": "utm_source"}, "is", 5, "value"),
        ({"param": "utm_source"}, "is", "x" * 501, "value"),
        ({"param": "utm_medium"}, "is", "x", "source"),
    ]:
        errors = check(logic(rules=[rule({"question": 4}, cond(source, op, value))]))[1]
        assert f"logic.branch.rules.0.when.conditions.0.{field}" in errors, (source, op, value, errors)


# ---- targets --------------------------------------------------------------------


def test_targets_must_exist_and_questions_must_come_later():
    for target in ({"question": 4}, {"question": 6}, {"ending": 11}, {"end": True}):
        assert check(logic(rules=[rule(target, cond({"question": 1}))]))[1] == {}, target
        assert check(logic(otherwise=target))[1] == {}, target

    for target in ({"question": 3}, {"question": 1}, {"question": 99}, {"ending": 99}):
        errors = check(logic(rules=[rule(target, cond({"question": 1}))], otherwise=target))[1]
        assert "logic.branch.rules.0.to" in errors, target
        assert "logic.branch.otherwise" in errors, target


# ---- calculations -----------------------------------------------------------------


def calc(op="add", value=None, variable="score", conditions=None):
    return {
        "op": op,
        "value": value if value is not None else {"number": 1},
        "variable": variable,
        "when": when(*(conditions or [cond({"question": 1})])),
    }


def test_calculations_change_declared_number_variables():
    ok = [calc("subtract", {"variable": "score"}), calc("divide", {"number": 0}), calc("multiply", {"number": -3.5})]
    assert check(logic(calc=ok))[1] == {}

    for bad, key in [
        (calc(variable="tag"), "logic.calc.0.variable"),
        (calc(variable="nope"), "logic.calc.0.variable"),
        (calc(value={"variable": "tag"}), "logic.calc.0.value"),
        (calc(value={"variable": "nope"}), "logic.calc.0.value"),
        (calc(value={"number": 1_000_001}), "logic.calc.0.value.number"),
        (calc(value={"number": True}), "logic.calc.0.value.number"),
        (calc(value={"number": 1, "variable": "score"}), "logic.calc.0.value"),
        (calc(value={}), "logic.calc.0.value"),
        (calc(op="set"), "logic.calc.0.op"),
        (calc(conditions=[cond({"question": 4})]), "logic.calc.0.when.conditions.0.source"),
    ]:
        assert key in check(logic(calc=[bad]))[1], bad


def test_errors_use_the_given_prefix():
    errors = check(logic(rules=[rule({"question": 3}, cond({"question": 1}))]), prefix="questions.3")[1]
    assert "questions.3.branch.rules.0.to" in errors


def test_groups_cannot_carry_rules_but_statements_can():
    rules = logic(rules=[rule({"end": True}, cond({"question": 1}))])
    assert "logic" in check(rules, on=6)[1]
    assert check(rules, on=5)[1] == {}  # a statement after Q1 may branch


# ---- variables, URL parameters, outcome ------------------------------------------------


def variables(*extra):
    return [{"name": "score", "type": "number", "initial": 0}, *extra]


def test_variable_lists():
    ok = variables({"name": "bonus_2", "type": "number", "initial": -1.5}, {"name": "tag", "type": "text", "initial": "x" * 200})
    clean, errors = check_variables(ok)
    assert errors == {} and clean == ok

    bad = {
        "no score": [{"name": "other", "type": "number", "initial": 0}],
        "score is text": [{"name": "score", "type": "text", "initial": "0"}],
        "duplicate": variables({"name": "score", "type": "number", "initial": 1}),
        "price": variables({"name": "price", "type": "number", "initial": 0}),
        "segment": variables({"name": "segment", "type": "text", "initial": ""}),
        "uppercase": variables({"name": "Bonus", "type": "number", "initial": 0}),
        "starts with digit": variables({"name": "1x", "type": "number", "initial": 0}),
        "too long": variables({"name": "a" * 41, "type": "number", "initial": 0}),
        "text initial too long": variables({"name": "t", "type": "text", "initial": "x" * 201}),
        "number with text initial": variables({"name": "n", "type": "number", "initial": "5"}),
        "text with number initial": variables({"name": "t", "type": "text", "initial": 5}),
        "bool initial": variables({"name": "n", "type": "number", "initial": True}),
        "too many": variables(*[{"name": f"v{i}", "type": "number", "initial": 0} for i in range(21)]),
    }
    for label, value in bad.items():
        clean, errors = check_variables(value)
        assert clean is None and errors, label
    assert check_variables(variables(*[{"name": f"v{i}", "type": "number", "initial": 0} for i in range(20)]))[1] == {}
    assert "variables.1.name" in check_variables(bad["duplicate"])[1]
    assert "variables.1.name" in check_variables(bad["price"])[1]


def test_url_parameter_lists():
    ok = ["utm_source", "email", "my_Param9"]
    assert check_url_parameters(ok) == (ok, {})
    assert check_url_parameters([]) == ([], {})
    for label, value in {
        "duplicate": ["a", "a"],
        "digit first": ["1a"],
        "dash": ["a-b"],
        "too long": ["a" * 41],
        "too many": [f"p{i}" for i in range(31)],
    }.items():
        clean, errors = check_url_parameters(value)
        assert clean is None and errors, label
    assert "url_parameters.1" in check_url_parameters(["a", "a"])[1]
    assert check_url_parameters([f"p{i}" for i in range(30)])[1] == {}


def test_outcome_entries_name_existing_choices_of_choice_questions():
    st = state()
    ok = [{"question": 1, "choice": "a"}, {"question": 3, "choice": "b"}, {"question": 1, "choice": "a"}]
    clean, errors = check_outcome(st, ok, "endings.10.outcome")
    assert errors == {}
    assert clean == [{"question": 1, "choice": "a"}, {"question": 3, "choice": "b"}]  # duplicates dropped

    for entry, field in [
        ({"question": 1, "choice": "zzz"}, "choice"),
        ({"question": 2, "choice": "a"}, "question"),
        ({"question": 99, "choice": "a"}, "question"),
        ({"question": 4, "choice": "a"}, "question"),
    ]:
        clean, errors = check_outcome(st, [entry], "endings.10.outcome")
        assert clean is None and f"endings.10.outcome.0.{field}" in errors, entry

    clean, errors = check_outcome(st, [{"question": 1, "choice": f"c{i}"} for i in range(51)], "o")
    assert clean is None and "o" in errors


def test_logic_model_is_strict_about_extra_fields():
    with pytest.raises(ValidationError):
        Logic.model_validate({"version": 2, "hide": []})
