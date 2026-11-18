Feature: Recurring class schedules

  Scenario: Teacher schedules a weekly class
    Given a teacher is authenticated
    And a student named "Maryam Noor" exists
    When the teacher schedules a weekly class for "Maryam Noor" starting tomorrow at "19:00"
    Then "Maryam Noor" has 4 upcoming sessions starting at "7:00 PM"

  Scenario: Teacher skips a class date
    Given a teacher is authenticated
    And a student named "Imran Shah" exists with a weekly class starting tomorrow
    When the teacher skips the class on that date
    Then "Imran Shah" has 3 upcoming sessions

  Scenario: Parent sees only their own child's classes
    Given a teacher is authenticated
    And a student named "Own Child" exists with a weekly class starting tomorrow
    And a student named "Other Child" exists with a weekly class starting tomorrow
    And a parent account is linked only to "Own Child"
    When the parent logs in
    Then the parent sees upcoming sessions only for "Own Child"