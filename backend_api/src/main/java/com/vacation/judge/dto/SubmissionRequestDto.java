package com.vacation.judge.dto;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class SubmissionRequestDto {
    private Long userId;
    private Long problemId;
    private String code;
    private String language;
}
