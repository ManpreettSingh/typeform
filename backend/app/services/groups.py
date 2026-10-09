from sqlalchemy.orm import Session
from app.models.question import Question

def add_to_group(db: Session, question: Question, group: Question) -> Question:
    """Moves the question to sit after the group's last child."""
    question.group_id = group.id
    
    # We need to reorder the form's questions so that `question` is after the group's last child.
    form = group.form
    ordered = list(form.questions)
    
    # Remove question from current position
    ordered.remove(question)
    
    # Find the group's position in `ordered`
    group_index = ordered.index(group)
    
    # Find the last child's index
    last_child_index = group_index
    for i in range(group_index + 1, len(ordered)):
        if ordered[i].group_id == group.id:
            last_child_index = i
        else:
            break
            
    # Insert right after the last child
    ordered.insert(last_child_index + 1, question)
    
    from app.services.questions import _renumber
    _renumber(db, ordered)
    
    return question

def remove_from_group(db: Session, question: Question) -> Question:
    """Moves it right after the group."""
    if question.group_id is None:
        return question
        
    form = question.form
    # Find the group
    group = next(q for q in form.questions if q.id == question.group_id)
    question.group_id = None
    
    ordered = list(form.questions)
    ordered.remove(question)
    
    group_index = ordered.index(group)
    last_child_index = group_index
    for i in range(group_index + 1, len(ordered)):
        if ordered[i].group_id == group.id:
            last_child_index = i
        else:
            break
            
    # Insert right after the group's last child (which is effectively after the group)
    ordered.insert(last_child_index + 1, question)
    
    from app.services.questions import _renumber
    _renumber(db, ordered)
    
    return question

def delete_group(db: Session, group: Question):
    """Deletes header and children."""
    form = group.form
    from app.services.questions import without_jumps_to, _renumber, _commit_question_change
    
    children = [q for q in form.questions if q.group_id == group.id]
    to_delete = {group.id} | {q.id for q in children}
    
    remaining = [q for q in form.questions if q.id not in to_delete]
    
    for q in remaining:
        q.logic = without_jumps_to(q.logic, to_delete)
        
    for q in children:
        db.delete(q)
    db.flush()
    db.delete(group)
    db.flush()
    
    _renumber(db, remaining)
    _commit_question_change(db, form)
