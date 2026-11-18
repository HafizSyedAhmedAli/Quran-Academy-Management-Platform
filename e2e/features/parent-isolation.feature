Feature: Parent student data isolation

  Scenario: Application is reachable
    Given the application is running
    When I open the home page
    Then I see the page load successfully

  Scenario: Parent views their associated student
    Given a parent is authenticated
    And the student is associated with that parent
    When the parent requests the student dashboard
    Then the application displays that student's information

  Scenario: Parent attempts to access another student's information
    Given a parent is authenticated
    And a student is not associated with that parent
    When the parent requests that student's information
    Then the application rejects the request
    And no unauthorized student data is returned