import pytest
from app.schemas.properties import MultipleChoiceProperties, DropdownProperties, RatingProperties, ChoiceOption

def test_min_selections_enforced():
    with pytest.raises(ValueError):
        MultipleChoiceProperties(
            options=[ChoiceOption(id="1", label="1"), ChoiceOption(id="2", label="2")],
            allow_multiple=False,
            min_selections=1
        )
    with pytest.raises(ValueError):
        MultipleChoiceProperties(
            options=[ChoiceOption(id="1", label="1"), ChoiceOption(id="2", label="2")],
            allow_multiple=True,
            min_selections=0
        )
    # Valid
    MultipleChoiceProperties(
        options=[ChoiceOption(id="1", label="1"), ChoiceOption(id="2", label="2")],
        allow_multiple=True,
        min_selections=1
    )

def test_max_selections_enforced():
    with pytest.raises(ValueError):
        MultipleChoiceProperties(
            options=[ChoiceOption(id="1", label="1")],
            allow_multiple=True,
            max_selections=2
        )
    with pytest.raises(ValueError):
        MultipleChoiceProperties(
            options=[ChoiceOption(id="1", label="1"), ChoiceOption(id="2", label="2")],
            allow_multiple=True,
            min_selections=2,
            max_selections=1
        )
    # Valid
    MultipleChoiceProperties(
        options=[ChoiceOption(id="1", label="1"), ChoiceOption(id="2", label="2")],
        allow_multiple=True,
        min_selections=1,
        max_selections=2
    )

def test_none_of_the_above_is_exclusive():
    props = MultipleChoiceProperties(
        options=[ChoiceOption(id="1", label="1")],
        none_of_the_above=True
    )
    assert props.none_of_the_above is True

def test_randomize_keeps_ids():
    props = DropdownProperties(
        options=[ChoiceOption(id="1", label="1")],
        randomize=True
    )
    assert props.randomize is True

def test_rating_accepts_new_shapes():
    for shape in ["cat", "dog", "thunderbolt", "skull"]:
        props = RatingProperties(shape=shape)
        assert props.shape == shape

def test_old_properties_still_load():
    # Should validate without the new optional fields
    MultipleChoiceProperties(options=[ChoiceOption(id="1", label="1")])
    DropdownProperties(options=[ChoiceOption(id="1", label="1")])
    RatingProperties()
