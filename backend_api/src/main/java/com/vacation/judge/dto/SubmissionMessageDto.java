package com.vacation.judge.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class SubmissionMessageDto {
    private Long submission_id;
    private String code;
    private String language;
    private String input_data;
    private String expected_output;
    private int timeout;
}
