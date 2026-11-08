import type { Department, Position } from '../types';

/**
 * Department / Position dropdown options. Both lists come from the database;
 * a position is only offered under the department it belongs to. A record that
 * still holds a value from before the lists were replaced shows that value as
 * "(no longer available)" so it is never silently dropped.
 */

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/** Active positions of one department (by department name). */
export function positionsOf(departments: Department[], positions: Position[], department: string): Position[] {
    const dept = departments.find(d => same(d.name, department));
    return dept ? positions.filter(p => p.department_id === dept.id) : [];
}

export function DepartmentOptions({ departments, value }: { departments: Department[]; value: string }) {
    return (
        <>
            {departments.map(d => <option value={d.name} key={d.id}>{d.name}</option>)}
            {value && !departments.some(d => same(d.name, value)) && <option value={value}>{value} (no longer available)</option>}
        </>
    );
}

export function PositionOptions({ departments, positions, department, value }: {
    departments: Department[]; positions: Position[]; department: string; value: string;
}) {
    const options = positionsOf(departments, positions, department);
    return (
        <>
            {options.map(p => <option value={p.title} key={p.id}>{p.title}</option>)}
            {value && !options.some(p => same(p.title, value)) && <option value={value}>{value} (no longer available)</option>}
        </>
    );
}

/** The position to keep after the department changed: the current one if it belongs there, else none. */
export function positionAfterDepartmentChange(departments: Department[], positions: Position[], department: string, position: string): string {
    return positionsOf(departments, positions, department).some(p => same(p.title, position)) ? position : '';
}

/**
 * Why this department + position cannot be saved ('' when it can). Values left
 * exactly as the record had them are accepted; any change must be a position
 * that belongs to the chosen department. The server applies the same rule.
 */
export function assignmentError(
    departments: Department[], positions: Position[],
    department: string, position: string,
    _original?: { department: string; position: string },
): string {
    if (!department.trim() && !position.trim()) return '';
    if (!department.trim()) return 'Please select a department.';
    if (!position.trim()) return 'Please select a position for the selected department.';
    return positionsOf(departments, positions, department).some(p => same(p.title, position))
        ? ''
        : 'Please select a department and a position that belongs to that department.';
}
